import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillLevel } from "../preferences/model.ts";
import { loadFollowedAuthorIds } from "../utils/followedProjectAuthors.ts";
import {
  PROJECT_FEED_FIELDS,
  parseFeedProject,
  type FeedProject
} from "./projectFeed.ts";

export type FollowingFeedFilters = {
  beginnerOnly?: boolean;
  collaboratorsOnly?: boolean;
  skillLevel?: SkillLevel | "";
};

export async function loadFollowingFeed(
  client: Pick<SupabaseClient, "from">,
  userId: string,
  filters: FollowingFeedFilters = {}
): Promise<FeedProject[]> {
  if (!userId)
    throw new Error("Sign in to load your following feed.");

  const [authorIds, memberships] = await Promise.all([
    loadFollowedAuthorIds(async (followerId) => {
      const { data, error } = await client
        .from("user_follows")
        .select("followed_id")
        .eq("follower_id", followerId);
      return { data, error };
    }, userId),
    client
      .from("community_memberships")
      .select("community_id")
      .eq("user_id", userId)
  ]);
  if (memberships.error)
    throw new Error(memberships.error.message);
  const communityIds = [
    ...new Set(
      (memberships.data ?? []).map((row) => {
        if (
          typeof row?.community_id !== "string" ||
          !row.community_id
        )
          throw new Error(
            "A community membership record is malformed."
          );
        return row.community_id as string;
      })
    )
  ];

  // Separate IN queries safely bind IDs, include either source independently,
  // and avoid interpolating IDs into PostgREST filter expressions.
  const projectQuery = () => {
    let query = client
      .from("projects")
      .select(
        `${PROJECT_FEED_FIELDS},community_id,community:communities!projects_community_id_fkey(id,name)`
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (filters.beginnerOnly)
      query = query.eq("beginner_friendly", true);
    if (filters.collaboratorsOnly)
      query = query.eq("looking_for_collaborators", true);
    if (filters.skillLevel)
      query = query.eq("skill_level", filters.skillLevel);
    return query;
  };
  const queries = [];
  if (authorIds.length)
    queries.push(projectQuery().in("author_id", authorIds));
  if (communityIds.length)
    queries.push(
      projectQuery().in("community_id", communityIds)
    );
  const results = await Promise.all(queries);
  const projects = new Map<string, FeedProject>();
  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
    for (const row of result.data ?? []) {
      const project = parseFeedProject(row);
      if (
        !project ||
        !Object.hasOwn(row, "community_id") ||
        !Object.hasOwn(row, "community")
      )
        throw new Error("A following feed post is malformed.");
      projects.set(project.id, project);
    }
  }
  return [...projects.values()].sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      b.id.localeCompare(a.id)
  );
}
