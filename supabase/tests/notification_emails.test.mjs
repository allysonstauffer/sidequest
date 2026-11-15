import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
const unconfirmed = "00000000-0000-4000-8000-000000000003";
const project = "00000000-0000-4000-8000-000000000004";

async function fixture({ oldFollow = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    insert into auth.users values
      ('${owner}','owner@example.invalid',now(),'{}'),
      ('${actor}','actor@example.invalid',now(),'{}'),
      ('${unconfirmed}','unverified@example.invalid',null,'{}');
    create table profiles(id uuid primary key references auth.users(id) on delete cascade,username text);
    insert into profiles values('${owner}','Project owner'),('${actor}','Test maker'),('${unconfirmed}','Unconfirmed member');
    create table projects(id uuid primary key,author_id uuid references profiles(id),title text not null);
    insert into projects values('${project}','${owner}','Paper garden');
    grant select on projects to authenticated;
  `);
  for (const name of [
    "202610280004_user_follows",
    "202610290004_project_likes_notifications",
    "202610300001_follow_notifications",
    "202610300002_notification_usernames"
  ])
    await db.exec(
      await readFile(
        new URL(`../migrations/${name}.sql`, import.meta.url),
        "utf8"
      )
    );
  if (oldFollow)
    await db.exec(
      `insert into user_follows values('${actor}','${owner}',now())`
    );
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202611150002_notification_emails.sql",
        import.meta.url
      ),
      "utf8"
    )
  );
  const as = async (id, role = "authenticated") => {
    await db.exec(`reset role; set role ${role}`);
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [id]
    );
  };
  const admin = async (sql, params = []) => {
    await db.exec("reset role");
    return db.query(sql, params);
  };
  const queue = async () =>
    (
      await admin(
        "select * from notification_email_outbox order by notification_id"
      )
    ).rows;
  const claim = async () => {
    await as("", "service_role");
    return (
      await db.query("select claim_notification_email() as job")
    ).rows[0].job;
  };
  const finish = async (job, sent) => {
    await as("", "service_role");
    return (
      await db.query(
        "select finish_notification_email($1,$2,$3) as confirmed",
        [job.notification_id, job.lease_token, sent]
      )
    ).rows[0].confirmed;
  };
  const follow = async (target = owner, follower = actor) => {
    await as(follower);
    await db.query(
      "insert into user_follows(follower_id,followed_id) values(auth.uid(),$1) on conflict do nothing",
      [target]
    );
  };
  const like = async (liked = true, liker = actor) => {
    await as(liker);
    await db.query("select set_project_like($1,$2)", [
      project,
      liked
    ]);
  };
  return { db, as, admin, queue, claim, finish, follow, like };
}

test("emails mirror new inbox likes/follows once, preserve read state, and keep addresses and delivery controls private", async () => {
  const f = await fixture({ oldFollow: true });
  try {
    assert.equal(
      (
        await f.admin(
          "select has_table_privilege('service_role','public.notifications','select') as permitted"
        )
      ).rows[0].permitted,
      true
    );
    const publication = (
      await f.admin(
        "select tablename from pg_publication_tables where pubname='supabase_realtime'"
      )
    ).rows;
    assert.ok(
      publication.some(
        (row) => row.tablename === "notifications"
      )
    );
    assert.equal(
      publication.some(
        (row) => row.tablename === "notification_email_outbox"
      ),
      false
    );
    assert.equal(
      (await f.queue()).length,
      0,
      "Historical notifications are not backfilled"
    );
    await f.admin("delete from user_follows");
    await f.follow();
    await f.follow();
    await f.like();
    await f.like();
    await f.like(true, owner); // Own-project likes do not produce inbox alerts.
    assert.equal((await f.queue()).length, 2);

    await f.as(owner);
    const inbox = (
      await f.db.query(
        "select * from notifications where dismissed_at is null"
      )
    ).rows;
    assert.equal(inbox.length, 2);
    assert.ok(
      inbox.every(
        (row) => !Object.hasOwn(row, "recipient_email")
      )
    );
    await f.db.query("select mark_notifications_read(null)");
    assert.equal(
      (await f.queue()).length,
      2,
      "Reading an alert does not queue another email"
    );

    const first = await f.claim();
    const second = await f.claim();
    assert.equal(
      first.recipient_email,
      "owner@example.invalid"
    );
    assert.equal(
      second.recipient_email,
      "owner@example.invalid"
    );
    assert.equal(first.actor_name, "Test maker");
    assert.deepEqual(
      new Set([first.type, second.type]),
      new Set(["project_like", "user_follow"])
    );
    assert.equal(
      await f.claim(),
      null,
      "Another worker cannot claim an active lease"
    );
    for (const role of ["anon", "authenticated"]) {
      await f.as(owner, role);
      await assert.rejects(
        f.db.query("select * from notification_email_outbox")
      );
      await assert.rejects(
        f.db.query("select * from auth.users")
      );
      await assert.rejects(
        f.db.query("select claim_notification_email()")
      );
      await assert.rejects(
        f.db.query(
          "select finish_notification_email($1,$2,true)",
          [first.notification_id, first.lease_token]
        )
      );
      await assert.rejects(
        f.db.query(
          "insert into notification_email_outbox(notification_id) values($1)",
          [first.notification_id]
        )
      );
    }
    assert.equal(await f.finish(first, true), true);
    assert.equal(
      await f.finish(first, true),
      false,
      "Repeated acknowledgements cannot change a sent job"
    );
    assert.equal(await f.finish(second, true), true);
    assert.equal(await f.claim(), null);
    assert.ok(
      (await f.queue()).every(
        (row) => row.status === "sent" && row.sent_at
      )
    );
    await f.as(owner);
    assert.ok(
      (
        await f.db.query(
          "select read_at from notifications where dismissed_at is null"
        )
      ).rows.every((row) => row.read_at)
    );
  } finally {
    await f.db.close();
  }
});

test("delivery failures back off, expired leases recover with new tokens, and exhausted jobs stop retrying", async () => {
  const f = await fixture();
  try {
    await f.follow();
    const first = await f.claim();
    assert.equal(
      await f.finish({ ...first, lease_token: project }, true),
      false
    );
    assert.equal(await f.finish(first, false), true);
    let [row] = await f.queue();
    assert.equal(row.status, "pending");
    assert.equal(row.attempts, 1);
    assert.ok(row.available_at.getTime() > Date.now() + 20000);
    assert.equal(await f.claim(), null);

    await f.admin(
      "update notification_email_outbox set available_at=now()-interval '1 second'"
    );
    const second = await f.claim();
    assert.notEqual(second.lease_token, first.lease_token);
    assert.equal(await f.finish(first, true), false);
    await f.admin(
      "update notification_email_outbox set locked_at=now()-interval '6 minutes'"
    );
    const recovered = await f.claim();
    assert.notEqual(recovered.lease_token, second.lease_token);
    assert.equal(await f.finish(second, true), false);
    assert.equal(await f.finish(recovered, true), true);
    assert.equal(await f.claim(), null);

    // A new like is independently retried and eventually marked failed.
    await f.like();
    for (let attempt = 1; attempt <= 8; attempt++) {
      await f.admin(
        "update notification_email_outbox set available_at=now()-interval '1 second' where status='pending'"
      );
      const job = await f.claim();
      assert.ok(job);
      assert.equal(await f.finish(job, false), true);
    }
    row = (await f.queue()).find(
      (item) => item.status === "failed"
    );
    assert.equal(row.attempts, 8);
    assert.equal(row.last_error, "smtp_delivery_failed");
    assert.equal(await f.claim(), null);
    // A crash on the final attempt also reaches a terminal state.
    await f.admin(
      "update notification_email_outbox set status='processing',locked_at=now()-interval '6 minutes' where status='failed'"
    );
    assert.equal(await f.claim(), null);
    assert.equal(
      (await f.queue()).find((item) => item.status === "failed")
        .last_error,
      "attempt_limit_reached"
    );
  } finally {
    await f.db.close();
  }
});

test("dismissal, unverified recipients, rollback, account updates, and deletion are handled without browser involvement", async () => {
  const f = await fixture();
  try {
    await f.follow(unconfirmed);
    await f.like();
    await f.like(false);
    assert.equal(await f.claim(), null);
    assert.ok(
      (await f.queue()).every(
        (row) => row.status === "cancelled"
      )
    );

    // A rolled-back follow cannot leave an email behind.
    await f.as(actor);
    await f.db.exec("begin");
    await f.db.query(
      "insert into user_follows(follower_id,followed_id) values(auth.uid(),$1)",
      [owner]
    );
    await f.db.exec("rollback");
    assert.equal((await f.queue()).length, 2);

    await f.follow();
    await f.admin(
      "update auth.users set email='updated@example.invalid' where id=$1",
      [owner]
    );
    const job = await f.claim();
    assert.equal(
      job.recipient_email,
      "updated@example.invalid",
      "Delivery uses the current verified account address"
    );
    await f.finish(job, true);

    await f.like(); // Fresh like after unlike creates a fresh inbox event and email.
    const queued = (await f.queue()).find(
      (row) => row.status === "pending"
    );
    assert.ok(queued);
    await f.admin("delete from projects where id=$1", [
      project
    ]);
    assert.equal(
      (await f.queue()).some(
        (row) => row.notification_id === queued.notification_id
      ),
      false
    );
    assert.equal(await f.claim(), null);
    await f.admin("delete from auth.users where id=$1", [
      owner
    ]);
    assert.equal(
      (await f.queue()).filter((row) => row.status === "sent")
        .length,
      0
    );
  } finally {
    await f.db.close();
  }
});
