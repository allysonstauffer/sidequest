import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

for (const messageType of ["uuid", "bigint"]) {
  test(`unread messages (${messageType} IDs) count incoming messages privately and acknowledge only the viewed chat`, async () => {
    const db = new PGlite();
    const alice = "00000000-0000-4000-8000-000000000001";
    const bob = "00000000-0000-4000-8000-000000000002";
    const carol = "00000000-0000-4000-8000-000000000003";
    const outsider = "00000000-0000-4000-8000-000000000004";
    const direct = "00000000-0000-4000-8000-000000000005";
    const group = "00000000-0000-4000-8000-000000000006";
    let sequence = 10;
    const messageId = () =>
      messageType === "bigint"
        ? String(sequence++)
        : `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
    const as = async (id, role = "authenticated") => {
      await db.exec(`reset role; set role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [id]
      );
    };
    const send = async (room = direct) => {
      const id = messageId();
      await db.query(
        "insert into messages(id,room_id,sender_id,text,created_at) values($1,$2,auth.uid(),'hello','2026-10-30T00:00:00Z')",
        [id, room]
      );
      return id;
    };
    const counts = async () =>
      (
        await db.query(
          "select get_message_unread_counts() as counts"
        )
      ).rows[0].counts.sort((a, b) =>
        a.room_id.localeCompare(b.room_id)
      );
    const mark = async (room, ids) =>
      (
        await db.query(
          "select mark_room_messages_read($1,$2::text[]) as changed",
          [room, ids]
        )
      ).rows[0].changed;
    try {
      await db.exec(`
        create role anon; create role authenticated; create schema auth;
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema public,auth to anon,authenticated;
        create table auth.users(id uuid primary key);
        insert into auth.users values('${alice}'),('${bob}'),('${carol}'),('${outsider}');
        create table rooms(id uuid primary key);
        insert into rooms values('${direct}'),('${group}');
        create table room_participants(room_id uuid references rooms(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,primary key(room_id,user_id));
        insert into room_participants values('${direct}','${alice}'),('${direct}','${bob}'),('${group}','${alice}'),('${group}','${bob}'),('${group}','${carol}');
        grant select on room_participants to authenticated;
        create table messages(id ${messageType} primary key,room_id uuid references rooms(id) on delete cascade,sender_id uuid references auth.users(id) on delete cascade,text text,created_at timestamptz default now());
        alter table messages enable row level security;
        grant select,insert on messages to authenticated;
        create policy members_read on messages for select to authenticated using(exists(select 1 from room_participants p where p.room_id=messages.room_id and p.user_id=auth.uid()));
        create policy sender_insert on messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from room_participants p where p.room_id=messages.room_id and p.user_id=auth.uid()));
      `);
      // Existing history has no reliable read state and starts without a badge.
      await as(alice);
      await send();
      await db.exec("reset role");
      await db.exec(
        await readFile(
          new URL(
            "../migrations/202610300003_unread_messages.sql",
            import.meta.url
          ),
          "utf8"
        )
      );
      await as(bob);
      assert.deepEqual(await counts(), []);

      await as(alice);
      const first = await send();
      const second = await send();
      const groupMessage = await send(group);
      assert.deepEqual(await counts(), []); // Sending does not notify yourself.
      await as(bob);
      assert.deepEqual(await counts(), [
        { room_id: direct, unread_count: 2 },
        { room_id: group, unread_count: 1 }
      ]);
      assert.equal(await mark(direct, [first]), 1);
      assert.equal(await mark(direct, [first]), 0);
      assert.deepEqual(await counts(), [
        { room_id: direct, unread_count: 1 },
        { room_id: group, unread_count: 1 }
      ]);

      // A message arriving after the history fetch must remain unread.
      await as(alice);
      const arriving = await send();
      await as(bob);
      assert.equal(await mark(direct, [second]), 1);
      assert.deepEqual(await counts(), [
        { room_id: direct, unread_count: 1 },
        { room_id: group, unread_count: 1 }
      ]);
      assert.equal(
        await mark(direct, [arriving, groupMessage]),
        1
      );
      assert.deepEqual(await counts(), [
        { room_id: group, unread_count: 1 }
      ]);
      await as(carol);
      assert.deepEqual(await counts(), [
        { room_id: group, unread_count: 1 }
      ]);
      assert.equal(await mark(group, [groupMessage]), 1);
      await as(bob);
      assert.deepEqual(await counts(), [
        { room_id: group, unread_count: 1 }
      ]);
      await assert.rejects(
        db.query("update message_receipts set read_at=now()")
      );
      await assert.rejects(
        db.query(
          "insert into message_receipts(message_id,room_id,recipient_id) values($1,$2,$3)",
          [groupMessage, group, alice]
        )
      );
      await assert.rejects(
        db.query("delete from message_receipts")
      );

      await as(outsider);
      assert.deepEqual(await counts(), []);
      assert.equal(
        (await db.query("select * from message_receipts")).rows
          .length,
        0
      );
      await assert.rejects(mark(group, [groupMessage]));
      await assert.rejects(send(group));
      await as("", "anon");
      await assert.rejects(counts());
      await assert.rejects(mark(group, [groupMessage]));

      // A loaded reply clears older incoming history even if that history
      // was outside the latest batch. Sending the reply never counts as unread.
      await as(alice);
      await send();
      await send();
      await as(bob);
      const reply = await send();
      assert.equal(await mark(direct, [reply]), 2);
      assert.deepEqual(await counts(), [
        { room_id: group, unread_count: 1 }
      ]);

      // Receipt insertion and message insertion succeed or roll back together.
      await db.exec(
        `reset role; alter table message_receipts add constraint test_receipt_failure check(recipient_id <> '${bob}') not valid`
      );
      await as(alice);
      const before = (
        await db.query("select count(*) as total from messages")
      ).rows[0].total;
      await assert.rejects(send());
      assert.equal(
        (
          await db.query(
            "select count(*) as total from messages"
          )
        ).rows[0].total,
        before
      );

      // Leaving a conversation hides its receipts; deleting messages cleans them up.
      await db.exec(
        `reset role; delete from room_participants where room_id='${group}' and user_id='${bob}'`
      );
      await as(bob);
      assert.deepEqual(await counts(), []);
      await assert.rejects(mark(group, [groupMessage]));
      await db.exec("reset role; delete from messages");
      assert.equal(
        (await db.query("select * from message_receipts")).rows
          .length,
        0
      );
    } finally {
      await db.close();
    }
  });
}
