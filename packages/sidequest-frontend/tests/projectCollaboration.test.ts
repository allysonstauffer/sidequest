import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { saveProjectCollaboration } from "../src/lib/projectCollaboration.ts";

const projectId = "33333333-3333-4333-8333-333333333333";

function clientWithResponse(fetch: typeof globalThis.fetch) {
  return createClient(
    "https://example.supabase.co",
    "synthetic-publishable-key",
    {
      global: { fetch },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );
}

test("the flag RPC receives the project ID and desired boolean", async () => {
  let requests = 0;
  const client = clientWithResponse(async (input, init) => {
    requests += 1;
    assert.equal(
      String(input),
      "https://example.supabase.co/rest/v1/rpc/set_project_collaboration"
    );
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      p_project_id: projectId,
      p_looking_for_collaborators: true
    });
    return Response.json(true);
  });
  assert.equal(
    await saveProjectCollaboration(client, projectId, true),
    true
  );
  assert.equal(requests, 1);
});

test("false is a confirmed save when closing a collaboration request", async () => {
  const client = clientWithResponse(async () =>
    Response.json(false)
  );
  assert.equal(
    await saveProjectCollaboration(client, projectId, false),
    false
  );
});

test("ownership errors reach the toggle instead of reporting success", async () => {
  const client = clientWithResponse(async () =>
    Response.json(
      {
        code: "42501",
        message: "Project not found or you do not own it.",
        details: null,
        hint: null
      },
      { status: 403 }
    )
  );
  await assert.rejects(
    saveProjectCollaboration(client, projectId, true),
    /do not own/
  );
});

test("unconfirmed and malformed responses cannot change the card", async () => {
  for (const response of [null, {}, "true", false]) {
    const client = clientWithResponse(async () =>
      Response.json(response)
    );
    await assert.rejects(
      saveProjectCollaboration(client, projectId, true),
      /did not confirm/
    );
  }
});
