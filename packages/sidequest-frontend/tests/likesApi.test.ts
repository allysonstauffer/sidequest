import assert from "node:assert/strict";
import test from "node:test";
import { saveLike } from "../src/lib/likesApi.ts";

test("like/unlike use explicit HTTP actions and confirm counts with user auth", async (t) => {
  for (const liked of [true, false]) {
    const mock = t.mock.method(
      globalThis,
      "fetch",
      async (
        url: string,
        init: NonNullable<Parameters<typeof fetch>[1]>
      ) => {
        assert.equal(url, "/api/projects/project-id/like");
        assert.equal(init.method, liked ? "POST" : "DELETE");
        assert.equal(
          (init.headers as Record<string, string>)
            .Authorization,
          "Bearer test-token"
        );
        return Response.json({
          project_id: "project-id",
          liked,
          like_count: liked ? 1 : 0
        });
      }
    );
    assert.equal(
      (await saveLike("project-id", liked, "test-token")).liked,
      liked
    );
    mock.mock.restore();
  }
});

test("failed or ambiguous responses never confirm a heart change", async (t) => {
  for (const body of [
    null,
    {},
    { project_id: "other", liked: true, like_count: 1 },
    { project_id: "project-id", liked: false, like_count: 1 },
    { project_id: "project-id", liked: true, like_count: -1 }
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json(body)
    );
    await assert.rejects(
      saveLike("project-id", true, "token"),
      /did not confirm/
    );
    mock.mock.restore();
  }
});

test("like permission errors retain an actionable message", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { detail: "This project is unavailable." },
      { status: 403 }
    )
  );
  await assert.rejects(
    saveLike("project-id", true, "token"),
    /unavailable/
  );
});
