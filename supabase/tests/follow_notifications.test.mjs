import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("follower alerts are private, atomic, retry-safe, and compatible with likes", async () => {
  const db = new PGlite();
  const recipient = "00000000-0000-4000-8000-000000000001";
  const follower = "00000000-0000-4000-8000-000000000002";
  const outsider = "00000000-0000-4000-8000-000000000003";
  const project = "00000000-0000-4000-8000-000000000004";
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated;
      create table auth.users(id uuid primary key);
      create table profiles(id uuid primary key references auth.users(id) on delete cascade,username text);
      insert into auth.users values('${recipient}'),('${follower}'),('${outsider}');
      insert into profiles values('${recipient}','Owner'),('${follower}','Follower'),('${outsider}','Outsider');
      create table projects(id uuid primary key,author_id uuid references profiles(id),title text not null);
      insert into projects values('${project}','${recipient}','Garden');
      grant select on projects to authenticated;
    `);
    for (const name of [
      "202610280004_user_follows.sql",
      "202610290004_project_likes_notifications.sql",
      "202610300001_follow_notifications.sql"
    ]) {
      await db.exec(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8"
        )
      );
    }
    const as = async (id, role = "authenticated") => {
      await db.exec(`reset role; set role ${role};`);
      await db.query(
        "select set_config('request.jwt.claim.sub', $1, false)",
        [id]
      );
    };
    const follow = (target) =>
      db.query(
        "insert into user_follows(follower_id,followed_id) values(auth.uid(),$1) on conflict (follower_id,followed_id) do nothing",
        [target]
      );
    const alerts = async () =>
      (
        await db.query(
          "select * from notifications where dismissed_at is null order by created_at,id"
        )
      ).rows;

    await as(follower);
    await follow(recipient);
    await follow(recipient);
    assert.equal((await alerts()).length, 0);
    await assert.rejects(follow(follower));
    await assert.rejects(
      db.query(
        "insert into user_follows(follower_id,followed_id) values($1,$2)",
        [outsider, recipient]
      )
    );

    await as(recipient);
    const [alert] = await alerts();
    assert.equal((await alerts()).length, 1);
    assert.equal(alert.type, "user_follow");
    assert.equal(alert.actor_id, follower);
    assert.equal(alert.actor_name, "Follower");
    assert.equal(alert.recipient_id, recipient);
    assert.equal(alert.project_id, null);
    assert.equal(alert.like_id, null);
    assert.equal(alert.project_title, null);
    assert.equal(alert.read_at, null);
    // The same follow write used by the profile and follow-back buttons notifies the other account.
    await follow(follower);
    await db.query("select mark_notifications_read($1)", [
      alert.id
    ]);
    assert.ok((await alerts())[0].read_at);
    await as(follower);
    assert.equal((await alerts())[0].actor_id, recipient);

    await as(outsider);
    assert.equal((await alerts()).length, 0);
    assert.equal(
      (
        await db.query(
          "select mark_notifications_read($1) as changed",
          [alert.id]
        )
      ).rows[0].changed,
      0
    );
    await assert.rejects(
      db.query("update notifications set actor_name='Fake'")
    );
    await assert.rejects(
      db.query(
        "insert into notifications(recipient_id,actor_id,type,actor_name) values($1,$2,'user_follow','Fake')",
        [recipient, outsider]
      )
    );
    await db.query(
      "delete from user_follows where follower_id=$1",
      [follower]
    );

    await as(follower);
    await db.query(
      "delete from user_follows where follower_id=auth.uid() and followed_id=$1",
      [recipient]
    );
    await as(recipient);
    assert.equal((await alerts()).length, 0);
    assert.ok(
      (
        await db.query(
          "select dismissed_at from notifications where id=$1",
          [alert.id]
        )
      ).rows[0].dismissed_at
    );

    await as(follower);
    await follow(recipient);
    await db.query("select set_project_like($1,true)", [
      project
    ]);
    await as(recipient);
    const renewed = (await alerts()).find(
      (item) => item.type === "user_follow"
    );
    assert.notEqual(renewed.id, alert.id);
    assert.equal(renewed.read_at, null);
    assert.equal((await alerts()).length, 2);
    assert.equal(
      (await alerts()).find(
        (item) => item.type === "project_like"
      ).project_id,
      project
    );
    assert.equal(
      (
        await db.query(
          "select mark_notifications_read() as changed"
        )
      ).rows[0].changed,
      2
    );
    await db.exec(
      `reset role; delete from projects where id='${project}'`
    );
    await as(recipient);
    assert.equal((await alerts()).length, 1);

    // A notification failure rolls back the follow rather than silently losing the alert.
    await db.exec(
      "reset role; alter table notifications add constraint test_notification_failure check(actor_name <> 'Outsider')"
    );
    await as(outsider);
    await assert.rejects(follow(recipient));
    assert.equal(
      (await db.query("select * from user_follows")).rows
        .length,
      0
    );
    await as("", "anon");
    await assert.rejects(follow(recipient));
    await assert.rejects(
      db.query("select * from notifications")
    );
    await db.exec(
      `reset role; delete from auth.users where id='${follower}'`
    );
    assert.equal(
      (await db.query("select * from notifications")).rows
        .length,
      0
    );
    assert.equal(
      (await db.query("select * from user_follows")).rows
        .length,
      0
    );
  } finally {
    await db.close();
  }
});
