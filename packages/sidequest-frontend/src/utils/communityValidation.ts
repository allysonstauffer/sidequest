export type CommunityDraft = {
  name: string;
  description: string;
  hobby: string;
};

export function validateCommunityDraft(
  draft: CommunityDraft,
  categoryIds: readonly string[]
): string | null {
  const name = draft.name.trim();
  if (!name || name.length > 100) {
    return "Community name must be 1 to 100 characters.";
  }
  if (draft.description.length > 1000) {
    return "Description must be 1000 characters or fewer.";
  }
  if (draft.hobby && !categoryIds.includes(draft.hobby)) {
    return "Choose an available hobby category.";
  }
  return null;
}

export function createHobbyCategoryId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
