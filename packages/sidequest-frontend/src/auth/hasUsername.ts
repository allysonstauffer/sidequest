import type { User } from "@supabase/supabase-js";

export function hasUsername(user: User): boolean {
  const username = user.user_metadata?.display_name;
  return typeof username === "string" && username.trim().length > 0;
}
