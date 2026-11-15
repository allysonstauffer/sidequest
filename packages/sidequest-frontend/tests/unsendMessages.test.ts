import assert from "node:assert/strict";
import test from "node:test";
import {
  canUnsendMessage,
  mergeMessages,
  parseChatMessage,
  unsendChatMessage,
  type ChatMessage
} from "../src/messages/chatMessages.ts";

const original: ChatMessage = {
  id: "1",
  room_id: "chat",
  sender_id: "sender",
  text: "Private message",
  image_path: null,
  created_at: "2026-11-15T12:00:00Z",
  unsent_at: null
};
const tombstone: ChatMessage = {
  ...original,
  text: "Message unsent",
  unsent_at: "2026-11-15T12:01:00Z"
};

test("unsend is available only to the sender strictly before the two-minute deadline", () => {
  const sent = Date.parse(original.created_at);
  assert.equal(
    canUnsendMessage(original, "sender", sent),
    true
  );
  assert.equal(
    canUnsendMessage(original, "sender", sent + 119999),
    true
  );
  assert.equal(
    canUnsendMessage(original, "sender", sent + 120000),
    false
  );
  assert.equal(
    canUnsendMessage(original, "sender", sent - 1),
    false
  );
  assert.equal(
    canUnsendMessage(original, "recipient", sent),
    false
  );
  assert.equal(
    canUnsendMessage(tombstone, "sender", sent),
    false
  );
  assert.equal(
    canUnsendMessage(
      { ...original, created_at: "invalid" },
      "sender",
      sent
    ),
    false
  );
});

test("tombstones suppress original content and survive stale history or send responses", () => {
  const removed = parseChatMessage({
    ...tombstone,
    text: "Old secret",
    image_path: "old/photo.png"
  });
  assert.equal(removed.text, "Message unsent");
  assert.equal(removed.image_path, null);
  assert.deepEqual(mergeMessages([removed], [original]), [
    removed
  ]);
  assert.deepEqual(mergeMessages([original], [removed]), [
    removed
  ]);
  assert.throws(() =>
    parseChatMessage({
      ...tombstone,
      unsent_at: "bad timestamp"
    })
  );
});

function fixture({
  userId = "sender",
  data = tombstone as unknown,
  error = null as null | { code: string; message: string },
  cleanupFails = false
} = {}) {
  const calls: unknown[] = [];
  const removed: string[] = [];
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: userId } } },
        error: null
      })
    },
    rpc: async (name: string, params: unknown) => {
      calls.push([name, params]);
      return { data, error };
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(...paths);
          if (cleanupFails) throw new Error("offline");
          return { error: null };
        }
      })
    }
  } as unknown as Parameters<typeof unsendChatMessage>[0];
  return { client, calls, removed };
}

test("unsending uses the guarded RPC and only cleans up images after a confirmed tombstone", async () => {
  const f = fixture({ cleanupFails: true });
  assert.deepEqual(
    await unsendChatMessage(
      f.client,
      { ...original, image_path: "chat/sender/photo.png" },
      "sender"
    ),
    tombstone
  );
  assert.deepEqual(f.calls, [
    ["unsend_message", { p_message_id: "1" }]
  ]);
  assert.deepEqual(f.removed, ["chat/sender/photo.png"]);
});

test("changed accounts, expired windows, and unconfirmed responses cannot report success or delete photos", async () => {
  const switched = fixture({ userId: "another-user" });
  await assert.rejects(
    unsendChatMessage(switched.client, original, "sender"),
    /sign in again/
  );
  assert.deepEqual(switched.calls, []);
  for (const options of [
    {
      error: {
        code: "22023",
        message: "Messages can only be unsent within 2 minutes."
      }
    },
    { data: original },
    { data: { ...tombstone, id: "another-message" } },
    { data: { ...tombstone, sender_id: "another-user" } },
    { data: null }
  ]) {
    const f = fixture(options);
    await assert.rejects(
      unsendChatMessage(
        f.client,
        { ...original, image_path: "photo.png" },
        "sender"
      )
    );
    assert.deepEqual(f.removed, []);
  }
});
