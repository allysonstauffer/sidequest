import assert from "node:assert/strict";
import test from "node:test";
import {
  sendChatMessage,
  validateMessageImage
} from "../src/messages/chatMessages.ts";

function fixture({
  uploadFails = false,
  saveError = "",
  recovered = false,
  userId = "viewer"
} = {}) {
  const uploads: string[] = [];
  const removed: string[] = [];
  const inserts: Record<string, unknown>[] = [];
  let lookupPath = "";
  const saved = () => ({
    id: 1,
    ...inserts[0],
    created_at: "2026-10-30T00:00:00Z"
  });
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: userId } } },
        error: null
      })
    },
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, "dm-images");
        return {
          upload: async (
            path: string,
            file: File,
            options: { contentType: string; upsert: boolean }
          ) => {
            uploads.push(path);
            assert.equal(options.contentType, file.type);
            assert.equal(options.upsert, false);
            return {
              error: uploadFails ? { message: "offline" } : null
            };
          },
          remove: async (paths: string[]) => {
            removed.push(...paths);
            return { error: null };
          }
        };
      }
    },
    from: (table: string) => {
      assert.equal(table, "messages");
      const query = {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return query;
        },
        select: () => query,
        eq: (_key: string, value: string) => {
          lookupPath = value;
          return query;
        },
        single: async () => ({
          data: saveError ? null : saved(),
          error: saveError ? { code: saveError } : null
        }),
        maybeSingle: async () => ({
          data: recovered
            ? { ...saved(), image_path: lookupPath }
            : null,
          error: null
        })
      };
      return query;
    }
  } as unknown as Parameters<typeof sendChatMessage>[0];
  return { client, uploads, removed, inserts };
}
const photo = () =>
  new File(["synthetic image"], "photo.png", {
    type: "image/png"
  });

test("image-only messages upload privately, preserve a storage path, and confirm the saved message", async () => {
  const f = fixture();
  const message = await sendChatMessage(f.client, {
    roomId: "chat",
    userId: "viewer",
    text: "",
    image: photo()
  });
  assert.match(f.uploads[0], /^chat\/viewer\/[a-f0-9-]+\.png$/);
  assert.equal(message.id, "1");
  assert.equal(message.text, "Photo");
  assert.equal(message.image_path, f.uploads[0]);
  assert.deepEqual(f.removed, []);
});

test("captions and existing text-only messages both remain supported", async () => {
  for (const image of [photo(), null]) {
    const f = fixture();
    const message = await sendChatMessage(f.client, {
      roomId: "chat",
      userId: "viewer",
      text: "  A caption  ",
      image
    });
    assert.equal(message.text, "A caption");
    assert.equal(f.uploads.length, image ? 1 : 0);
    assert.equal(
      message.image_path,
      image ? f.uploads[0] : null
    );
  }
});

test("invalid files and changed accounts cannot upload or insert a message", async () => {
  for (const file of [
    { type: "image/svg+xml", size: 10 },
    { type: "image/png", size: 0 },
    { type: "image/png", size: 10485761 }
  ])
    assert.throws(() => validateMessageImage(file));
  const f = fixture({ userId: "another-user" });
  await assert.rejects(
    sendChatMessage(f.client, {
      roomId: "chat",
      userId: "viewer",
      text: "",
      image: photo()
    }),
    /sign in again/
  );
  assert.deepEqual(f.uploads, []);
  assert.deepEqual(f.inserts, []);
});

test("failed uploads never create a message; definite save failures clean up unused uploads", async () => {
  const upload = fixture({ uploadFails: true });
  await assert.rejects(
    sendChatMessage(upload.client, {
      roomId: "chat",
      userId: "viewer",
      text: "",
      image: photo()
    }),
    /upload your photo/
  );
  assert.deepEqual(upload.inserts, []);
  const save = fixture({ saveError: "42501" });
  await assert.rejects(
    sendChatMessage(save.client, {
      roomId: "chat",
      userId: "viewer",
      text: "",
      image: photo()
    }),
    /Could not send/
  );
  assert.deepEqual(save.removed, save.uploads);
});

test("lost responses recover a committed image message without deleting its image", async () => {
  const f = fixture({
    saveError: "FETCH_ERROR",
    recovered: true
  });
  const message = await sendChatMessage(f.client, {
    roomId: "chat",
    userId: "viewer",
    text: "hello",
    image: photo()
  });
  assert.equal(message.image_path, f.uploads[0]);
  assert.deepEqual(f.removed, []);
  const uncertain = fixture({ saveError: "FETCH_ERROR" });
  await assert.rejects(
    sendChatMessage(uncertain.client, {
      roomId: "chat",
      userId: "viewer",
      text: "",
      image: photo()
    })
  );
  assert.deepEqual(uncertain.removed, []);
});
