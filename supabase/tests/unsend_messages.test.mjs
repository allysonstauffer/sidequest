import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

for (const idType of ["bigint", "uuid"]) {
  test(`unsending (${idType} IDs) enforces ownership and server time and preserves a private tombstone`, async () => {
    const db = new PGlite();
    const alice = "00000000-0000-4000-8000-000000000001";
    const bob = "00000000-0000-4000-8000-000000000002";
    const outsider = "00000000-0000-4000-8000-000000000003";
    const room = "00000000-0000-4000-8000-000000000004";
    const otherRoom = "00000000-0000-4000-8000-000000000005";
    const id = (n) =>
      idType === "uuid"
        ? `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
        : String(n);
    const image = `${room}/${alice}/00000000-0000-4000-8000-000000000006.png`;
    const as = async (user, role = "authenticated") => {
      await db.exec(`reset role; set role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [user]
      );
    };
    const unsend = async (messageId) =>
      (
        await db.query("select unsend_message($1) as message", [
          messageId
        ])
      ).rows[0].message;
    const message = async (n) =>
      (
        await db.query(
          "select * from messages where id::text=$1",
          [id(n)]
        )
      ).rows[0];
    try {
      await db.exec(`
        create role anon; create role authenticated; create schema auth; create schema storage;
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema auth,public,storage to anon,authenticated;
        create table auth.users(id uuid primary key);
        insert into auth.users values('${alice}'),('${bob}'),('${outsider}');
        create table rooms(id uuid primary key);
        insert into rooms values('${room}'),('${otherRoom}');
        create table room_participants(room_id uuid references rooms(id),user_id uuid references auth.users(id),primary key(room_id,user_id));
        insert into room_participants values('${room}','${alice}'),('${room}','${bob}');
        grant select on room_participants to authenticated,anon;
        create table messages(id ${idType} primary key,room_id uuid references rooms(id),sender_id uuid references auth.users(id),text text not null check(length(btrim(text))>0),created_at timestamptz default now());
        alter table messages enable row level security;
        grant select,insert,update,delete on messages to authenticated;
        grant select on messages to anon;
        create policy messages_read on messages for select to authenticated using(exists(select 1 from room_participants p where p.room_id=messages.room_id and p.user_id=auth.uid()));
        create policy messages_send on messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from room_participants p where p.room_id=messages.room_id and p.user_id=auth.uid()));
        -- The new restrictions must hold even against legacy permissive writes.
        create policy legacy_message_edits on messages for update to authenticated using(true) with check(true);
        create policy legacy_message_deletes on messages for delete to authenticated using(true);
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
        alter table storage.objects enable row level security;
        grant select,insert,update,delete on storage.objects to authenticated;
        grant select on storage.objects to anon;
        create policy legacy_storage_access on storage.objects for all to authenticated using(true) with check(true);
      `);
      for (const name of [
        "202610300003_unread_messages",
        "202610300004_message_images"
      ])
        await db.exec(
          await readFile(
            new URL(
              `../migrations/${name}.sql`,
              import.meta.url
            ),
            "utf8"
          )
        );

      // Seed legacy messages before timestamps become server-controlled.
      await db.exec(`
        insert into messages(id,room_id,sender_id,text,created_at) values
          ('${id(1)}','${room}','${alice}','Recent secret',clock_timestamp()-interval '30 seconds'),
          ('${id(2)}','${room}','${alice}','Expired secret',clock_timestamp()-interval '2 minutes'),
          ('${id(3)}','${room}','${bob}','Not yours',clock_timestamp()),
          ('${id(4)}','${otherRoom}','${alice}','No longer a member',clock_timestamp()),
          ('${id(5)}','${room}','${alice}','Photo',clock_timestamp()),
          ('${id(6)}','${room}','${alice}','Future legacy timestamp',clock_timestamp()+interval '1 hour');
      `);
      await as(alice);
      await db.query(
        "insert into storage.objects(bucket_id,name) values('dm-images',$1)",
        [image]
      );
      // Existing validation runs for image association too.
      await db.query(
        "update messages set image_path=$1 where id::text=$2",
        [image, id(5)]
      );
      await db.exec("reset role");
      await db.exec(
        await readFile(
          new URL(
            "../migrations/202611150001_unsend_messages.sql",
            import.meta.url
          ),
          "utf8"
        )
      );
      assert.equal(
        (
          await db.query(
            "select * from pg_publication_tables where pubname='supabase_realtime' and tablename='messages'"
          )
        ).rows.length,
        1
      );

      await as("", "anon");
      await assert.rejects(unsend(id(1)));
      await as("");
      await assert.rejects(unsend(id(1)), /Sign in/);
      await as(outsider);
      await assert.rejects(unsend(id(1)), /unavailable/);
      await as(bob);
      await assert.rejects(unsend(id(1)), /not yours/);
      await as(alice);
      await assert.rejects(unsend(id(4)), /unavailable/);
      await assert.rejects(
        unsend("nonexistent"),
        /unavailable/
      );
      await assert.rejects(unsend(id(2)), /within 2 minutes/);
      await assert.rejects(unsend(id(6)), /within 2 minutes/);

      for (const change of [
        "text='Rewritten'",
        "created_at=clock_timestamp()",
        `sender_id='${bob}'`,
        "unsent_at=clock_timestamp()",
        "image_path=null"
      ]) {
        const result = await db.query(
          `update messages set ${change} where id::text=$1 returning id`,
          [id(2)]
        );
        assert.equal(result.rows.length, 0);
      }
      assert.equal(
        (
          await db.query(
            "delete from messages where id::text=$1 returning id",
            [id(2)]
          )
        ).rows.length,
        0
      );
      assert.equal((await message(2)).text, "Expired secret");

      const original = await message(1);
      const removed = await unsend(id(1));
      assert.equal(removed.text, "Message unsent");
      assert.equal(removed.image_path, null);
      assert.ok(removed.unsent_at);
      assert.equal(removed.sender_id, alice);
      assert.equal(
        new Date(removed.created_at).getTime(),
        original.created_at.getTime()
      );
      assert.equal(
        JSON.stringify(removed).includes("Recent secret"),
        false
      );
      await as(bob);
      assert.equal((await message(1)).text, "Message unsent");
      assert.equal(
        (
          await db.query(
            "select * from message_receipts where message_id::text=$1 and read_at is null",
            [id(1)]
          )
        ).rows.length,
        0
      );
      assert.equal(
        (
          await db.query(
            "select name from storage.objects where name=$1",
            [image]
          )
        ).rows.length,
        1
      );
      await as(alice);
      await unsend(id(5));
      await as(bob);
      assert.equal((await message(5)).image_path, null);
      assert.equal(
        (
          await db.query(
            "select name from storage.objects where name=$1",
            [image]
          )
        ).rows.length,
        0
      );
      assert.equal((await message(3)).text, "Not yours");

      // Retries stay idempotent after the original deadline; content cannot return.
      await db.exec("reset role");
      await db.query(
        "update messages set created_at=clock_timestamp()-interval '1 day' where id::text=$1",
        [id(1)]
      );
      await as(alice);
      assert.equal(
        (await unsend(id(1))).unsent_at,
        removed.unsent_at
      );
      assert.equal(
        (
          await db.query(
            "update messages set text='Restored',unsent_at=null where id::text=$1 returning id",
            [id(1)]
          )
        ).rows.length,
        0
      );
      await db.query(
        "delete from storage.objects where name=$1",
        [image]
      );
      assert.equal(
        (
          await db.query(
            "select name from storage.objects where name=$1",
            [image]
          )
        ).rows.length,
        0
      );

      // Submitted timestamps and tombstones cannot forge or extend the window.
      await db.query(
        "insert into messages(id,room_id,sender_id,text,created_at,unsent_at) values($1,$2,$3,'New message','2099-01-01','2099-01-01')",
        [id(7), room, alice]
      );
      const stamped = await message(7);
      assert.equal(stamped.unsent_at, null);
      assert.ok(
        Math.abs(Date.now() - stamped.created_at.getTime()) <
          10000
      );
      assert.ok((await unsend(id(7))).unsent_at);
      await db.exec(
        `reset role; delete from room_participants where room_id='${room}' and user_id='${alice}'`
      );
      await as(alice);
      await assert.rejects(unsend(id(1)), /unavailable/);
    } finally {
      await db.close();
    }
  });
}
