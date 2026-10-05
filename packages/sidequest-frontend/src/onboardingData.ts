import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export type Hobby = { hobby: string; experience_level: string };
export type Setup = {
  profile: Profile | null;
  hobbies: Hobby[];
};
type Database = Pick<SupabaseClient, "from">;

export function isSetupComplete({ profile, hobbies }: Setup) {
  return Boolean(
    profile?.username?.trim() &&
    profile.display_name?.trim() &&
    hobbies.some(
      (item) =>
        item.hobby.trim() && item.experience_level?.trim()
    )
  );
}

export async function loadSetup(
  db: Database,
  userId: string
): Promise<Setup> {
  const [profileResult, hobbyResult] = await Promise.all([
    db
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", userId)
      .maybeSingle(),
    db
      .from("user_hobbies")
      .select("hobby, experience_level")
      .eq("user_id", userId)
  ]);
  if (profileResult.error)
    throw new Error(
      `Unable to load your profile: ${profileResult.error.message}`
    );
  if (hobbyResult.error)
    throw new Error(
      `Unable to load your hobbies: ${hobbyResult.error.message}`
    );
  return {
    profile: profileResult.data,
    hobbies: hobbyResult.data ?? []
  };
}

export async function saveSetup(
  db: Database,
  userId: string,
  username: string,
  displayName: string,
  hobbies: Hobby[]
) {
  const profile = {
    id: userId,
    username: username.trim(),
    display_name: displayName.trim()
  };
  const hobbyRows = hobbies
    .filter((item) => item.hobby.trim())
    .map((item) => ({
      user_id: userId,
      hobby: item.hobby.trim(),
      experience_level: item.experience_level
    }));
  if (!profile.username || !profile.display_name)
    throw new Error("Enter a username and display name.");
  // Re-read before writing so a retry can recover from a partially saved setup.
  const existing = await loadSetup(db, userId);
  if (!hobbyRows.length && !existing.hobbies.length)
    throw new Error(
      "Choose at least one hobby and its skill level."
    );

  const { data, error } = await db
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select("id")
    .single();
  if (error)
    throw new Error(
      `Unable to save your profile: ${error.message}`
    );
  if (!data)
    throw new Error(
      "Your profile could not be saved. Please try again."
    );

  const savedNames = new Set(
    existing.hobbies.map((item) =>
      item.hobby.trim().toLowerCase()
    )
  );
  const missing = hobbyRows.filter((item) => {
    const name = item.hobby.toLowerCase();
    if (savedNames.has(name)) return false;
    savedNames.add(name);
    return true;
  });
  if (missing.length) {
    const { error: hobbyError } = await db
      .from("user_hobbies")
      .insert(missing);
    if (hobbyError)
      throw new Error(
        `Unable to save your hobbies: ${hobbyError.message}`
      );
  }
  const saved = await loadSetup(db, userId);
  if (!isSetupComplete(saved))
    throw new Error(
      "Setup is still incomplete. Please check your profile and hobbies and try again."
    );
  return saved;
}
