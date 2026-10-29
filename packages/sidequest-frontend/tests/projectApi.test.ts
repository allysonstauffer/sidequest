import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteProject,
  publishProject
} from "../src/lib/projectApi.ts";

test("publishing requires a confirmed project and sends user auth", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ project: { id: "synthetic-project" } })
  );
  const formData = new FormData();
  await publishProject(formData, "synthetic-token");
  assert.deepEqual(request.mock.calls[0].arguments, [
    "/api/upload",
    {
      method: "POST",
      headers: { Authorization: "Bearer synthetic-token" },
      body: formData
    }
  ]);
});

test("HTML fallback with HTTP 200 cannot report publication success", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<!doctype html><html></html>", {
        headers: { "Content-Type": "text/html" }
      })
  );
  await assert.rejects(
    publishProject(new FormData(), "synthetic-token"),
    /did not confirm your post/
  );
});

test("JSON without a saved project cannot report publication success", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ project: {} })
  );
  await assert.rejects(
    publishProject(new FormData(), "synthetic-token"),
    /did not confirm your post/
  );
});

test("upload errors retain the server's actionable message", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        detail: "Could not upload the image. Please try again."
      },
      { status: 502 }
    )
  );
  await assert.rejects(
    publishProject(new FormData(), "synthetic-token"),
    /Could not upload the image/
  );
});

test("non-JSON server errors report the HTTP status", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Bad Gateway", { status: 502 })
  );
  await assert.rejects(
    publishProject(new FormData(), "synthetic-token"),
    /Request failed \(502\)/
  );
});

test("deletion also rejects a successful HTML fallback", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<!doctype html><html></html>")
  );
  await assert.rejects(
    deleteProject("synthetic-project", "synthetic-token"),
    /did not confirm deletion/
  );
});

test("confirmed deletion preserves the media cleanup notice", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ deleted: true, media_cleanup: false })
  );
  assert.deepEqual(
    await deleteProject("synthetic-project", "synthetic-token"),
    { mediaCleanup: false }
  );
});
