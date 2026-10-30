import type { SupabaseClient } from "@supabase/supabase-js";

export async function saveProjectCollaboration(
  client: Pick<SupabaseClient, "rpc">,
  projectId: string,
  active: boolean
): Promise<boolean> {
  const { data, error } = await client.rpc(
    "set_project_collaboration",
    {
      p_project_id: projectId,
      p_looking_for_collaborators: active
    }
  );

  if (error) throw new Error(error.message);
  // A false response is a successful save when the owner switches the flag off.
  if (data !== active) {
    throw new Error("The server did not confirm the change.");
  }
  return data;
}
