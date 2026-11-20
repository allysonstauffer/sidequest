import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("owners grant and revoke edit access without losing ownership", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-4000-8000-000000000001";
  const helper = "00000000-0000-4000-8000-000000000002";
  const outsider = "00000000-0000-4000-8000-000000000003";
  const project = "00000000-0000-4000-8000-000000000004";
  const quest = "00000000-0000-4000-8000-000000000005";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated;
      insert into auth.users values('${owner}'),('${helper}'),('${outsider}');
      create table profiles(id uuid primary key references auth.users(id),username text);
      insert into profiles values('${owner}','Owner'),('${helper}','Helper'),('${outsider}','Outsider');
      create table projects(id uuid primary key,author_id uuid references profiles(id),title text not null,
        description text,beginner_friendly boolean not null default false,skill_level text,
        looking_for_collaborators boolean not null default true);
      insert into projects(id,author_id,title) values('${project}','${owner}','Garden');
      create table sidequests(id uuid primary key,host_id uuid references auth.users(id),title text not null,
        description text not null default '',starts_at timestamptz not null default now(),
        ends_at timestamptz not null default now()+interval '1 hour',location text not null default 'Park',
        hobby text not null default 'gardening',skill_level text not null default 'Beginner');
      insert into sidequests(id,host_id,title) values('${quest}','${owner}','Meetup');
      create table collaboration_requests(id uuid primary key default gen_random_uuid(),project_id uuid,requester_id uuid,status text);
      insert into collaboration_requests(project_id,requester_id,status) values('${project}','${helper}','accepted');`);
    await db.exec(
      await readFile(
        new URL("../migrations/202610310001_edit_access.sql", import.meta.url),
        "utf8"
      )
    );
    const as = async (id) => {
      await db.exec("reset role; set role authenticated;");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    };
    const edit = (id, changes) =>
      db.query("select title from update_project_details($1, $2::jsonb)", [id, JSON.stringify(changes)]);
    const grant = (type, id, user, allowed) =>
      db.query("select set_edit_access($1,$2,$3,$4)", [type, id, user, allowed]);

    // An accepted collaboration request grants nothing.
    await as(helper);
    await assert.rejects(edit(project, { title: "Hijack" }), /permission/);

    // Only the owner can manage access.
    await assert.rejects(grant("project", project, helper, true), /Only the owner/);
    await as(owner);
    await assert.rejects(grant("project", project, owner, true), /full access/);
    await grant("project", project, helper, true);
    await grant("project", project, helper, true);
    assert.equal(
      (await db.query("select * from list_edit_access('project', $1)", [project])).rows.length,
      1
    );
    await as(helper);
    await assert.rejects(db.query("select * from list_edit_access('project', $1)", [project]), /Only the owner/);

    // Collaborator edits agreed details only.
    assert.equal((await edit(project, { title: " Garden 2 " })).rows[0].title, "Garden 2");
    await assert.rejects(edit(project, { author_id: helper }), /Only title/);
    await assert.rejects(edit(project, { looking_for_collaborators: false }), /Only title/);
    await assert.rejects(grant("project", project, outsider, true), /Only the owner/);

    // Outsiders cannot edit; grants are specific to the project and type.
    await as(outsider);
    await assert.rejects(edit(project, { title: "Nope" }), /permission/);
    await as(helper);
    await assert.rejects(
      db.query("select update_sidequest_details($1,'{\"title\":\"x\"}')", [quest]),
      /permission/
    );

    // Revocation removes access; the owner can still edit and manage.
    await as(owner);
    await grant("project", project, helper, false);
    await as(helper);
    await assert.rejects(edit(project, { title: "Again" }), /permission/);
    await as(owner);
    assert.equal((await edit(project, { title: "Owner edit" })).rows[0].title, "Owner edit");

    // Sidequests work the same way.
    await grant("sidequest", quest, helper, true);
    await as(helper);
    const updated = await db.query(
      "select title from update_sidequest_details($1,'{\"title\":\"New\"}')", [quest]);
    assert.equal(updated.rows[0].title, "New");
    await assert.rejects(
      db.query("select update_sidequest_details($1,'{\"host_id\":\"x\"}')", [quest]),
      /Only sidequest/
    );
    await as(owner);
    await grant("sidequest", quest, helper, false);
    await as(helper);
    await assert.rejects(
      db.query("select update_sidequest_details($1,'{\"title\":\"x\"}')", [quest]),
      /permission/
    );
  } finally {
    await db.close();
  }
});
