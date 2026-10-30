import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("likes and notifications enforce identity, privacy, retries, and atomic writes", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-4000-8000-000000000001";
  const liker = "00000000-0000-4000-8000-000000000002";
  const outsider = "00000000-0000-4000-8000-000000000003";
  const project = "00000000-0000-4000-8000-000000000004";
  const hidden = "00000000-0000-4000-8000-000000000005";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated;
      create table profiles(id uuid primary key,username text);
      insert into profiles values('${owner}','Owner'),('${liker}','Liker'),('${outsider}','Outsider');
      create table projects(id uuid primary key,author_id uuid references profiles(id),title text not null);
      insert into projects values('${project}','${owner}','Garden'),('${hidden}','${owner}','Hidden');
      alter table projects enable row level security;
      grant select on projects to authenticated;
      create policy project_visibility on projects for select to authenticated using(id <> '${hidden}');`);
    await db.exec(
      await readFile(
        new URL(
          "../migrations/202610290004_project_likes_notifications.sql",
          import.meta.url
        ),
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
    const like = async (active, id = project) =>
      (
        await db.query(
          "select set_project_like($1,$2) as result",
          [id, active]
        )
      ).rows[0].result;
    const notifications = async () =>
      (
        await db.query(
          "select * from notifications where dismissed_at is null"
        )
      ).rows;
    const mark = async (id = null) =>
      (
        await db.query(
          "select mark_notifications_read($1) as changed",
          [id]
        )
      ).rows[0].changed;

    await as(liker);
    assert.deepEqual(await like(true), {
      project_id: project,
      like_count: 1,
      liked: true
    });
    assert.deepEqual(await like(true), {
      project_id: project,
      like_count: 1,
      liked: true
    });
    assert.equal((await notifications()).length, 0);
    await assert.rejects(like(true, hidden));
    await assert.rejects(like(null));
    await assert.rejects(
      db.query(
        "insert into project_likes(project_id,user_id) values($1,$2)",
        [project, outsider]
      )
    );
    await assert.rejects(
      db.query("update project_likes set user_id=$1", [
        outsider
      ])
    );

    await as(owner);
    const alert = (await notifications())[0];
    assert.equal(alert.actor_name, "Liker");
    assert.equal(alert.project_id, project);
    assert.equal(alert.read_at, null);
    assert.equal((await notifications()).length, 1);
    assert.equal(await mark(alert.id), 1);
    assert.equal(await mark(alert.id), 0);
    assert.ok((await notifications())[0].read_at);
    // Liking your own project counts but never notifies yourself.
    assert.equal((await like(true)).like_count, 2);
    assert.equal((await notifications()).length, 1);
    await like(false);

    await as(outsider);
    assert.equal((await notifications()).length, 0);
    assert.equal(await mark(alert.id), 0);
    await assert.rejects(
      db.query("update notifications set read_at=now()")
    );
    await assert.rejects(db.query("delete from notifications"));
    await assert.rejects(
      db.query(
        "insert into notifications(recipient_id,actor_id,project_id,like_id,actor_name,project_title) values($1,$2,$3,$4,'Fake','Fake')",
        [owner, outsider, project, alert.like_id]
      )
    );
    await db.query(
      "delete from project_likes where user_id=$1",
      [liker]
    );
    assert.equal(
      (await db.query("select * from project_likes")).rows
        .length,
      1
    );

    await as(liker);
    assert.deepEqual(await like(false), {
      project_id: project,
      like_count: 0,
      liked: false
    });
    assert.equal((await like(false)).like_count, 0);
    await as(owner);
    assert.equal((await notifications()).length, 0);
    assert.ok(
      (
        await db.query(
          "select dismissed_at from notifications where id=$1",
          [alert.id]
        )
      ).rows[0].dismissed_at
    );
    await as(liker);
    await like(true);
    await as(owner);
    assert.equal((await notifications()).length, 1);
    assert.notEqual((await notifications())[0].id, alert.id);
    assert.equal(await mark(), 1);

    // A failed notification insert rolls back its like in the same transaction.
    await db.exec(
      "reset role; alter table notifications add constraint test_notification_failure check(actor_name <> 'Outsider')"
    );
    await as(outsider);
    await assert.rejects(like(true));
    assert.equal(
      (
        await db.query(
          "select * from project_likes where user_id=$1",
          [outsider]
        )
      ).rows.length,
      0
    );
    const summaries = (
      await db.query(
        "select * from get_project_like_summaries($1::uuid[])",
        [[project, hidden]]
      )
    ).rows;
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].liked, false);
    assert.equal(Number(summaries[0].like_count), 1);
    await as("");
    await assert.rejects(like(true));
    await assert.rejects(mark());
    await as("", "anon");
    await assert.rejects(like(true));
    await assert.rejects(
      db.query("select * from notifications")
    );
    await db.exec(
      `reset role; delete from projects where id='${project}'`
    );
    assert.equal(
      (await db.query("select * from project_likes")).rows
        .length,
      0
    );
    assert.equal(
      (await db.query("select * from notifications")).rows
        .length,
      0
    );
  } finally {
    await db.close();
  }
});
