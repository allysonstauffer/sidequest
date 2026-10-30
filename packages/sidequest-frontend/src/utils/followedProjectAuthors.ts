export type FollowRowsResult = {
  data: readonly unknown[] | null;
  error: { message: string } | null;
};

export type FollowRowsLoader = (
  followerId: string
) => Promise<FollowRowsResult>;

export async function loadFollowedAuthorIds(
  loadRows: FollowRowsLoader,
  followerId: string
): Promise<string[]> {
  if (!followerId) {
    throw new Error("Sign in to load followed projects.");
  }

  const result = await loadRows(followerId);
  if (result.error) throw new Error(result.error.message);

  const authorIds = (result.data ?? []).map((value) => {
    if (!value || typeof value !== "object") {
      throw new Error("A follow record is malformed.");
    }
    const followedId =
      "followed_id" in value ? value.followed_id : null;
    if (typeof followedId !== "string" || !followedId) {
      throw new Error("A follow record is malformed.");
    }
    return followedId;
  });

  return [...new Set(authorIds)];
}
