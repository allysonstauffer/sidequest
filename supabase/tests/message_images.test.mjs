import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("DM images stay private, validate ownership, preserve text messages, and create unread receipts", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-4000-8000-000000000001";
  const bob = "00000000-0000-4000-8000-000000000002";
  const outsider = "00000000-0000-4000-8000-000000000003";
  const room = "00000000-0000-4000-8000-000000000004";
  const otherRoom = "00000000-0000-4000-8000-000000000005";
  const image = `${room}/${alice}/00000000-0000-4000-8000-000000000006.png`;
  const draft = `${room}/${alice}/00000000-0000-4000-8000-000000000007.jpg`;
  const as = async (id, role = "authenticated") => {
    await db.exec(`reset role; set role ${role}`);
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [id]
    );
  };
  const upload = (path) =>
    db.query(
      "insert into storage.objects(bucket_id,name) values('dm-images',$1)",
      [path]
    );
  const send = (path = null, target = room, sender = alice) =>
    db.query(
      "insert into messages(room_id,sender_id,text,image_path) values($1,$2,'Photo',$3) returning *",
      [target, sender, path]
    );
  const visibleImages = async () =>
    (
      await db.query(
        "select name from storage.objects where bucket_id='dm-images'"
      )
    ).rows;
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
      insert into room_participants values('${room}','${alice}'),('${room}','${bob}'),('${otherRoom}','${alice}');
      grant select on room_participants to authenticated,anon;
      create table messages(id bigint generated always as identity primary key,room_id uuid references rooms(id),sender_id uuid references auth.users(id),text text not null check(length(btrim(text))>0),created_at timestamptz default now());
      alter table messages enable row level security;
      grant select,insert,update on messages to authenticated;
      grant usage on sequence messages_id_seq to authenticated;
      grant select on messages to anon;
      create policy messages_read on messages for select to authenticated using(exists(select 1 from room_participants p where p.room_id=messages.room_id and p.user_id=auth.uid()));
      create policy messages_send on messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from room_participants p where p.room_id=messages.room_id and p.user_id=auth.uid()));
      create policy messages_edit on messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
      -- Simulate an existing broad storage policy: new DM guards must still hold.
      create policy legacy_storage_access on storage.objects for all to authenticated using(true) with check(true);
      create policy legacy_anon_read on storage.objects for select to anon using(true);
    `);
    for (const name of [
      "202610300003_unread_messages",
      "202610300004_message_images"
    ])
      await db.exec(
        await readFile(
          new URL(`../migrations/${name}.sql`, import.meta.url),
          "utf8"
        )
      );
    const bucket = (
      await db.query(
        "select * from storage.buckets where id='dm-images'"
      )
    ).rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 10485760);
    assert.deepEqual(bucket.allowed_mime_types, [
      "image/jpeg",
      "image/png",
      "image/webp"
    ]);

    await as(alice);
    await upload(image);
    await upload(draft);
    await as(bob);
    assert.equal((await visibleImages()).length, 0); // Unsent images are private to their uploader.
    await assert.rejects(
      upload(image.replace(alice, bob).replace(".png", ".svg"))
    );
    await assert.rejects(upload(image));
    await as(outsider);
    await assert.rejects(
      upload(image.replace(alice, outsider))
    );
    assert.equal((await visibleImages()).length, 0);
    await as(alice);
    assert.equal((await send(image)).rows[0].image_path, image);
    await send(); // Existing text-only rows remain valid.
    await assert.rejects(send(image)); // One uploaded photo cannot be attached twice.
    await assert.rejects(send(draft, otherRoom));
    await assert.rejects(send(image.replace("006", "099")));
    await assert.rejects(send(draft, room, bob));
    assert.equal(
      (
        await db.query(
          "update storage.objects set name='replaced' where name=$1 returning name",
          [image]
        )
      ).rows.length,
      0
    );
    await db.query(
      "delete from storage.objects where name=$1",
      [image]
    );
    assert.equal((await visibleImages()).length, 2); // Sent images cannot be deleted as cleanup.
    await db.query(
      "delete from storage.objects where name=$1",
      [draft]
    );
    assert.equal((await visibleImages()).length, 1);

    await as(bob);
    assert.deepEqual(await visibleImages(), [{ name: image }]);
    assert.equal(
      (
        await db.query(
          "select get_message_unread_counts() as counts"
        )
      ).rows[0].counts[0].unread_count,
      2
    );
    await db.query(
      "delete from storage.objects where name=$1",
      [image]
    );
    assert.equal((await visibleImages()).length, 1);
    await as(outsider);
    assert.equal((await visibleImages()).length, 0);
    assert.equal(
      (await db.query("select * from messages")).rows.length,
      0
    );
    await as("", "anon");
    assert.equal((await visibleImages()).length, 0);
    await db.exec(
      `reset role; delete from room_participants where room_id='${room}' and user_id='${bob}'`
    );
    await as(bob);
    assert.equal((await visibleImages()).length, 0);
  } finally {
    await db.close();
  }
});
