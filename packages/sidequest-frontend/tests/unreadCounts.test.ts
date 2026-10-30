import assert from "node:assert/strict";
import test from "node:test";
import { parseUnreadCounts } from "../src/messages/unreadCounts.ts";

test("unread counts preserve room totals and reject unconfirmed counts", () => {
  assert.deepEqual(parseUnreadCounts([]), {});
  assert.deepEqual(
    parseUnreadCounts([
      { room_id: "chat", unread_count: 3 },
      { room_id: "group", unread_count: 2 }
    ]),
    { chat: 3, group: 2 }
  );
  for (const value of [
    null,
    {},
    [{ room_id: "chat", unread_count: "3" }],
    [{ room_id: "chat", unread_count: -1 }],
    [{ room_id: "chat", unread_count: 1.5 }],
    [
      { room_id: "chat", unread_count: 1 },
      { room_id: "chat", unread_count: 2 }
    ]
  ]) {
    assert.throws(() => parseUnreadCounts(value));
  }
});
