export type LikeSummary = {
  project_id: string;
  like_count: number;
  liked: boolean;
};

export function isLikeSummary(
  value: unknown
): value is LikeSummary {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.project_id === "string" &&
    typeof row.liked === "boolean" &&
    Number.isSafeInteger(row.like_count) &&
    (row.like_count as number) >= 0
  );
}

export async function saveLike(
  projectId: string,
  liked: boolean,
  token: string
): Promise<LikeSummary> {
  const base = import.meta.env?.VITE_API_BASE_URL ?? "";
  const response = await fetch(
    `${base.replace(/\/+$/, "")}/api/projects/${encodeURIComponent(projectId)}/like`,
    {
      method: liked ? "POST" : "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Could not save your like. Please try again."
    );
  if (
    !isLikeSummary(data) ||
    data.project_id !== projectId ||
    data.liked !== liked
  ) {
    throw new Error(
      "The server did not confirm your like. Refresh before retrying."
    );
  }
  return data;
}
