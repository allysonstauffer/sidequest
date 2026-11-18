import { SKILL_LEVELS } from "../preferences/model.ts";
import type { SkillLevel } from "../preferences/model.ts";
import { storedImageUrl } from "./storedImageUrl.ts";

export const PROJECT_FEED_FIELDS =
  "id,author_id,title,description,media_urls,created_at,looking_for_collaborators,beginner_friendly,skill_level";

export type FeedProject = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  media_urls: string[] | null;
  created_at: string;
  looking_for_collaborators: boolean;
  beginner_friendly: boolean;
  skill_level: SkillLevel | null;
  community_id: string | null;
  community: { id: string; name: string } | null;
};

export function parseFeedProject(
  value: unknown
): FeedProject | null {
  if (!value || typeof value !== "object") return null;
  const project = value as Record<string, unknown>;
  const community = project.community as
    Record<string, unknown> | null | undefined;
  if (
    typeof project.id !== "string" ||
    !project.id ||
    typeof project.author_id !== "string" ||
    !project.author_id ||
    typeof project.title !== "string" ||
    typeof project.created_at !== "string" ||
    !Number.isFinite(Date.parse(project.created_at)) ||
    typeof project.looking_for_collaborators !== "boolean" ||
    typeof project.beginner_friendly !== "boolean" ||
    (project.skill_level !== null &&
      !SKILL_LEVELS.some(
        (level) => level === project.skill_level
      )) ||
    (project.description !== null &&
      typeof project.description !== "string") ||
    (project.media_urls !== null &&
      (!Array.isArray(project.media_urls) ||
        !project.media_urls.every(
          (url) => typeof url === "string"
        ))) ||
    (project.community_id != null &&
      (typeof project.community_id !== "string" ||
        !project.community_id)) ||
    (community != null &&
      (typeof community !== "object" ||
        Array.isArray(community) ||
        typeof community.id !== "string" ||
        community.id !== project.community_id ||
        typeof community.name !== "string" ||
        !community.name.trim()))
  )
    return null;

  return {
    id: project.id,
    author_id: project.author_id,
    title: project.title,
    description: project.description as string | null,
    media_urls: Array.isArray(project.media_urls)
      ? project.media_urls
          .map((url) => storedImageUrl(url, "project-media", project.author_id as string))
          .filter((url): url is string => url !== null)
      : null,
    created_at: project.created_at,
    looking_for_collaborators:
      project.looking_for_collaborators,
    beginner_friendly: project.beginner_friendly,
    skill_level: project.skill_level as SkillLevel | null,
    community_id:
      (project.community_id as string | null) ?? null,
    community: community
      ? {
          id: community.id as string,
          name: community.name as string
        }
      : null
  };
}
