import catalogue from "../data/SideQuestHobbies.json" with { type: "json" };

export interface Hobby {
  id: string;
  label: string;
  keywords: readonly string[];
}

export type HobbyId = Hobby["id"];

export const HOBBIES: readonly Hobby[] = catalogue;
export const MAX_HOBBIES = 3;

const hobbyIds = new Set(HOBBIES.map(({ id }) => id));

export function isHobbyId(value: unknown): value is HobbyId {
  return typeof value === "string" && hobbyIds.has(value);
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const searchIndex = HOBBIES.map((hobby) => ({
  hobby,
  label: normalize(hobby.label),
  searchable: normalize(
    [hobby.label, ...hobby.keywords].join(" ")
  )
}));

export function searchHobbies(query: string): Hobby[] {
  const normalized = normalize(query);
  const terms = normalized.split(/\s+/).filter(Boolean);

  return searchIndex
    .filter(({ searchable }) =>
      terms.every((term) => searchable.includes(term))
    )
    .map(({ hobby, label }) => ({
      hobby,
      rank:
        !normalized || label === normalized
          ? 0
          : label.startsWith(normalized)
            ? 1
            : label.includes(normalized)
              ? 2
              : terms.every((term) => label.includes(term))
                ? 3
                : 4
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.hobby.label.localeCompare(b.hobby.label)
    )
    .map(({ hobby }) => hobby);
}
