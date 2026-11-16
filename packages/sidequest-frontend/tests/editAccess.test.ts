import assert from "node:assert/strict";
import test from "node:test";
import {
  grantEditAccess,
  listEditors,
  revokeEditAccess
} from "../src/lib/editAccessApi.ts";

test("granting and revoking send user auth to the editors endpoint", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async (_url: string, init: { method?: string; body?: unknown }) =>
    Response.json({ allowed: init.method === "PUT" })
  );
  await grantEditAccess("project", "p1", "u1", "tok");
  await revokeEditAccess("sidequest", "s1", "u1", "tok");
  const [grantUrl, grantInit] = request.mock.calls[0].arguments as [string, { method?: string; body?: unknown }];
  assert.equal(grantUrl, "/api/projects/p1/editors");
  assert.equal(grantInit.body, JSON.stringify({ user_id: "u1" }));
  const [revokeUrl, revokeInit] = request.mock.calls[1].arguments as [string, { method?: string; body?: unknown }];
  assert.equal(revokeUrl, "/api/sidequests/s1/editors/u1");
  assert.equal(revokeInit.method, "DELETE");
});

test("unconfirmed changes and permission errors are surfaced", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ allowed: false }));
  await assert.rejects(grantEditAccess("project", "p", "u", "t"), /did not confirm/);
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ detail: "Only the owner can manage edit access." }, { status: 403 })
  );
  await assert.rejects(listEditors("project", "p", "t"), /Only the owner/);
});
