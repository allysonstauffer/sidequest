import type { HobbyCommunity } from "../types/discovery.ts";

export function searchCommunitiesByTag(
  communities: HobbyCommunity[],
  searchTerm: string
): HobbyCommunity[] {
  const normalizedTerm = searchTerm.trim().toLocaleLowerCase();
  if (!normalizedTerm) return communities;

  return communities.filter((community) =>
    community.tags.some((tag) =>
      tag.toLocaleLowerCase().includes(normalizedTerm)
    )
  );
}
