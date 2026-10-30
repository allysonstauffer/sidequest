import assert from "node:assert/strict";
import test from "node:test";
import { loadFollowedAuthorIds } from "./followedProjectAuthors.ts";

test("loads distinct followed author ids for the signed-in user", async () => {
  const ids = await loadFollowedAuthorIds(
    async (followerId) => {
      assert.equal(followerId, "viewer-id");
      return {
        data: [
          { followed_id: "author-one" },
          { followed_id: "author-two" },
          { followed_id: "author-one" }
        ],
        error: null
      };
    },
    "viewer-id"
  );

  assert.deepEqual(ids, ["author-one", "author-two"]);
});

test("surfaces follow query errors", async () => {
  await assert.rejects(
    loadFollowedAuthorIds(
      async () => ({
        data: null,
        error: { message: "query failed" }
      }),
      "viewer-id"
    ),
    /query failed/
  );
});

test("rejects malformed follow rows instead of broadening the feed", async () => {
  await assert.rejects(
    loadFollowedAuthorIds(
      async () => ({
        data: [{ followed_id: 42 }],
        error: null
      }),
      "viewer-id"
    ),
    /malformed/
  );
});
