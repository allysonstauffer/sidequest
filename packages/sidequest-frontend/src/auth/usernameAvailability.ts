import type { SupabaseClient } from "@supabase/supabase-js";

export async function isUsernameAvailable(
  client: Pick<SupabaseClient, "rpc">,
  username: string
): Promise<boolean> {
  const { data, error } = await client.rpc("is_username_available", {
    p_username: username.trim()
  });
  if (error) throw error;
  return data === true;
}
