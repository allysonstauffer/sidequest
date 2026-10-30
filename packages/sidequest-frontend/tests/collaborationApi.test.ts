import assert from "node:assert/strict";
import test from "node:test";
import { saveCollaboration } from "../src/lib/collaborationApi.ts";

test("collaboration writes send JSON with the user's token and return confirmed status", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (
      url: string,
      init: NonNullable<Parameters<typeof fetch>[1]>
    ) => {
      assert.equal(
        url,
        "/api/projects/example/collaboration-requests"
      );
      assert.equal(init.method, "POST");
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        "Bearer test-token"
      );
      assert.deepEqual(JSON.parse(init.body as string), {
        message: "I can help"
      });
      return Response.json({
        request: { id: "test-id", status: "pending" }
      });
    }
  );
  assert.equal(
    (
      await saveCollaboration(
        "/api/projects/example/collaboration-requests",
        { message: "I can help" },
        "test-token"
      )
    ).status,
    "pending"
  );
});

test("collaboration errors preserve server explanations", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { detail: "This request has already been answered." },
      { status: 400 }
    )
  );
  await assert.rejects(
    saveCollaboration(
      "/api/test",
      { status: "accepted" },
      "test-token"
    ),
    /already been answered/
  );
});

test("HTML or malformed success cannot mark a request as sent", async (t) => {
  for (const response of [
    new Response("<html>fallback</html>"),
    Response.json({ request: null }),
    Response.json({ request: { id: "id", status: "unknown" } })
  ]) {
    const mock = t.mock.method(
      globalThis,
      "fetch",
      async () => response
    );
    await assert.rejects(
      saveCollaboration(
        "/api/test",
        { message: "Hello" },
        "test-token"
      ),
      /did not confirm/
    );
    mock.mock.restore();
  }
});
