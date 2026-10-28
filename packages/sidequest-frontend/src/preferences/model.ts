export const HOBBIES = [
  { id: "photography", label: "Photography" },
  { id: "gardening", label: "Gardening" },
  { id: "cooking", label: "Cooking" }
] as const;

export const SKILL_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert"
] as const;

export type HobbyId = string;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export type HobbySelection = Partial<
  Record<HobbyId, SkillLevel>
>;

export interface Preference {
  hobby: HobbyId;
  experience_level: SkillLevel;
}

export interface PreferencesSnapshot {
  complete: boolean;
  preferences: Preference[];
}

export interface PreferenceService {
  load(userId: string): Promise<PreferencesSnapshot>;
  save(preferences: Preference[]): Promise<void>;
}

export function isPreference(
  value: unknown
): value is Preference {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.hobby === "string" &&
    row.hobby.length > 0 &&
    SKILL_LEVELS.some((level) => level === row.experience_level)
  );
}

export function toSelection(
  preferences: readonly Preference[]
): HobbySelection {
  const selection: HobbySelection = {};

  for (const preference of preferences) {
    selection[preference.hobby] = preference.experience_level;
  }

  return selection;
}

export function toPreferences(
  selection: HobbySelection
): Preference[] {
  return Object.entries(selection).flatMap(([hobby, level]) =>
    level ? [{ hobby, experience_level: level }] : []
  );
}

export function validatePreferences(
  preferences: readonly Preference[]
): string | null {
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return "Select at least one hobby.";
  }
  if (!preferences.every(isPreference)) {
    return "Choose an available hobby and a valid experience level.";
  }
  if (
    new Set(preferences.map(({ hobby }) => hobby)).size !==
    preferences.length
  ) {
    return "Select each hobby only once.";
  }
  return null;
}
