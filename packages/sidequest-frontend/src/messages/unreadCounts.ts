export function parseUnreadCounts(
  value: unknown
): Record<string, number> {
  if (!Array.isArray(value))
    throw new Error("Unread counts unavailable.");
  const counts: Record<string, number> = {};
  for (const row of value) {
    if (
      !row ||
      typeof row.room_id !== "string" ||
      !row.room_id ||
      !Number.isSafeInteger(row.unread_count) ||
      row.unread_count < 0 ||
      Object.hasOwn(counts, row.room_id)
    ) {
      throw new Error("Unread counts unavailable.");
    }
    Object.defineProperty(counts, row.room_id, {
      value: row.unread_count,
      enumerable: true
    });
  }
  return counts;
}
