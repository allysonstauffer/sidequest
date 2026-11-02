import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("notifications use the account username and repair existing placeholder alerts", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-4000-8000-000000000001";
  const actor = "00000000-0000-4000-8000-000000000002";
  const legacy = "00000000-0000-4000-8000-000000000003";
  const unnamed = "00000000-0000-4000-8000-000000000004";
  const project = "00000000-0000-4000-8000-000000000005";
  const migrate = async (name) =>
    db.exec(
      await readFile(
        new URL(`../migrations/${name}.sql`, import.meta.url),
        "utf8"
      )
    );
  const as = async (id, role = "authenticated") => {
    await db.exec(`reset role; set role ${role};`);
    await db.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [id]
    );
  };
  const follow = (target) =>
    db.query(
      "insert into user_follows(follower_id,followed_id) values(auth.uid(),$1) on conflict do nothing",
      [target]
    );
  const alerts = async () =>
    (
      await db.query(
        "select * from notifications where dismissed_at is null order by type"
      )
    ).rows;
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create table profiles(id uuid primary key references auth.users(id) on delete cascade,username text);
      insert into auth.users values
        ('${owner}','{"display_name":"Owner"}'),
        ('${actor}','{"display_name":"Maya"}'),
        ('${legacy}','{"display_name":"   "}'),
        ('${unnamed}','{}');
      insert into profiles values('${owner}','Owner'),('${actor}',null),('${legacy}','Legacy name'),('${unnamed}','   ');
      create table projects(id uuid primary key,author_id uuid references profiles(id),title text not null);
      insert into projects values('${project}','${owner}','Garden');
      grant select on projects to authenticated;
    `);
    await migrate("202610280004_user_follows");
    await migrate("202610290004_project_likes_notifications");
    await migrate("202610300001_follow_notifications");

    // Reproduce signup accounts: metadata has a username, profiles does not.
    await as(actor);
    await follow(owner);
    await db.query("select set_project_like($1,true)", [
      project
    ]);
    await as(owner);
    const original = await alerts();
    assert.equal(original.length, 2);
    assert.ok(
      original.every((item) => item.actor_name === "A hobbyist")
    );
    await db.query("select mark_notifications_read()");

    await db.exec("reset role");
    await migrate("202610300002_notification_usernames");
    await as(owner);
    const repaired = await alerts();
    assert.ok(
      repaired.every((item) => item.actor_name === "Maya")
    );
    assert.deepEqual(
      repaired.map((item) => item.id),
      original.map((item) => item.id)
    );
    assert.ok(repaired.every((item) => item.read_at));
    await assert.rejects(
      db.query("select notification_actor_name($1)", [actor])
    );
    await assert.rejects(
      db.query("select raw_user_meta_data from auth.users")
    );

    // Settings updates metadata; new events must use the new name.
    await db.exec(
      `reset role; update auth.users set raw_user_meta_data='{"display_name":"  New username  "}' where id='${actor}'; update profiles set username='Stale profile name' where id='${actor}'`
    );
    await as(actor);
    await db.query(
      "delete from user_follows where follower_id=auth.uid()"
    );
    await db.query("select set_project_like($1,false)", [
      project
    ]);
    await follow(owner);
    await db.query("select set_project_like($1,true)", [
      project
    ]);
    await as(owner);
    assert.ok(
      (await alerts()).every(
        (item) => item.actor_name === "New username"
      )
    );
    assert.ok(
      (await alerts()).every((item) => item.read_at === null)
    );

    // Legacy profile names remain supported; blank names never display as empty text.
    await as(legacy);
    await follow(owner);
    await as(unnamed);
    await follow(owner);
    await as(owner);
    assert.equal(
      (await alerts()).find((item) => item.actor_id === legacy)
        .actor_name,
      "Legacy name"
    );
    assert.equal(
      (await alerts()).find((item) => item.actor_id === unnamed)
        .actor_name,
      "A hobbyist"
    );
    await as("", "anon");
    await assert.rejects(
      db.query("select notification_actor_name($1)", [actor])
    );
  } finally {
    await db.close();
  }
});
