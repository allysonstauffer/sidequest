import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  deleteProject as deleteProjectRequest,
  updateProject as updateProjectRequest
} from "../lib/projectApi";
import ProjectCollaborationToggle from "./ProjectCollaborationToggle";
import CollaborationRequestForm from "./CollaborationRequestForm";
import { useAuth } from "../auth/useAuth";
import LikeButton from "./LikeButton";
import { isLikeSummary, type LikeSummary } from "../lib/likesApi";
import { loadFollowedAuthorIds } from "../utils/followedProjectAuthors";
import { SKILL_LEVELS, type SkillLevel } from "../preferences/model";
import "./ProjectFeed.css";

type Project = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  media_urls: string[] | null;
  created_at: string;
  looking_for_collaborators: boolean;
  beginner_friendly: boolean;
  skill_level: SkillLevel | null;
};

type ProjectFeedProps = {
  authorId?: string;
  followedById?: string;
  accessToken?: string;
  title?: string;
  projectId?: string;
};

function parseProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;

  const project = value as Record<string, unknown>;
  if (
    typeof project.id !== "string" ||
    typeof project.author_id !== "string" ||
    typeof project.title !== "string" ||
    typeof project.created_at !== "string" ||
    typeof project.looking_for_collaborators !== "boolean" ||
    typeof project.beginner_friendly !== "boolean" ||
    (project.skill_level !== null &&
      !SKILL_LEVELS.some((level) => level === project.skill_level)) ||
    (project.description !== null &&
      typeof project.description !== "string") ||
    (project.media_urls !== null &&
      (!Array.isArray(project.media_urls) ||
        !project.media_urls.every(
          (url) => typeof url === "string"
        )))
  ) {
    return null;
  }

  return {
    id: project.id,
    author_id: project.author_id,
    title: project.title,
    description:
      typeof project.description === "string"
        ? project.description
        : null,
    media_urls: Array.isArray(project.media_urls)
      ? project.media_urls
      : null,
    created_at: project.created_at,
    looking_for_collaborators: project.looking_for_collaborators,
    beginner_friendly: project.beginner_friendly as boolean,
    skill_level: project.skill_level as SkillLevel | null
  };
}

export default function ProjectFeed(props: ProjectFeedProps) {
  const { session } = useAuth();
  return (
    <ProjectFeedContent
      key={`${session?.user.id ?? "guest"}:${props.projectId ?? "feed"}`}
      {...props}
    />
  );
}

function ProjectFeedContent({
  authorId,
  followedById,
  accessToken,
  title,
  projectId
}: ProjectFeedProps) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [projects, setProjects] = useState<Project[]>([]);
  const [likes, setLikes] = useState<Record<string, LikeSummary>>({});
  const [likesError, setLikesError] = useState("");
  const [likesRetry, setLikesRetry] = useState(0);
  const [collaboratorsOnly, setCollaboratorsOnly] = useState(false);
  const [beginnerOnly, setBeginnerOnly] = useState(false);
  const [skillFilter, setSkillFilter] = useState<SkillLevel | "">("");
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(
    null
  );
  const [editingId, setEditingId] = useState<string | null>(
    null
  );
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBeginnerFriendly, setEditBeginnerFriendly] = useState(false);
  const [editSkillLevel, setEditSkillLevel] = useState<SkillLevel | "">("");
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setStatus("loading");
      try {
        let followedAuthorIds: string[] | null = null;
        if (followedById) {
          followedAuthorIds = await loadFollowedAuthorIds(
            async (followerId) => {
              const { data, error } = await supabase
                .from("user_follows")
                .select("followed_id")
                .eq("follower_id", followerId);
              return { data, error };
            },
            followedById
          );
          if (followedAuthorIds.length === 0) {
            if (!active) return;
            setProjects([]);
            setLikes({});
            setLikesError("");
            setStatus("ready");
            return;
          }
        }

        let query = supabase
          .from("projects")
          .select(
            "id,author_id,title,description,media_urls,created_at,looking_for_collaborators,beginner_friendly,skill_level"
          )
          .order("created_at", { ascending: false });
        if (authorId) query = query.eq("author_id", authorId);
        if (projectId) query = query.eq("id", projectId);
        if (followedAuthorIds) {
          query = query.in("author_id", followedAuthorIds);
        }
        if (!authorId && !projectId && collaboratorsOnly) {
          query = query.eq("looking_for_collaborators", true);
        }
        if (!authorId && !projectId && beginnerOnly) {
          query = query.eq("beginner_friendly", true);
        }
        if (!authorId && !projectId && skillFilter) {
          query = query.eq("skill_level", skillFilter);
        }
        if (!authorId && !followedById && !projectId) query = query.limit(20);
        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const loadedProjects = (data ?? [])
          .map(parseProject)
          .filter((project): project is Project => project !== null);
        if (userId && loadedProjects.length > 0) {
          try {
            const result = await supabase.rpc("get_project_like_summaries", {
              p_project_ids: loadedProjects.map((project) => project.id)
            });
            if (
              result.error ||
              !Array.isArray(result.data) ||
              !result.data.every(isLikeSummary)
            ) {
              throw new Error("Could not load likes.");
            }
            if (!active) return;
            setLikes(Object.fromEntries(result.data.map((row: LikeSummary) => [row.project_id, row])));
            setLikesError("");
          } catch {
            if (!active) return;
            setLikes({});
            setLikesError("Could not load likes. You can still browse projects.");
          }
        } else {
          setLikes({});
          setLikesError("");
        }
        const authorIds = [...new Set(loadedProjects.map((project) => project.author_id))];
        let names: Record<string, string> = {};
        if (authorIds.length > 0) {
          const profiles = await supabase
            .from("creator_profiles")
            .select("user_id,username")
            .in("user_id", authorIds);
          if (!profiles.error) {
            names = Object.fromEntries(
              (profiles.data ?? [])
                .filter((profile) => typeof profile.username === "string")
                .map((profile) => [profile.user_id, profile.username as string])
            );
          }
        }
        if (!active) return;
        setProjects(loadedProjects);
        setCreatorNames(names);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadProjects();
    return () => {
      active = false;
    };
  }, [authorId, followedById, projectId, collaboratorsOnly, beginnerOnly, skillFilter, userId, likesRetry]);

  function startEditing(project: Project) {
    setOpenMenuId(null);
    setEditingId(project.id);
    setEditTitle(project.title);
    setEditDescription(project.description ?? "");
    setEditBeginnerFriendly(project.beginner_friendly);
    setEditSkillLevel(project.skill_level ?? "");
    setActionNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditBeginnerFriendly(false);
    setEditSkillLevel("");
  }

  async function saveProject(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!accessToken || !editingId || savingId) return;

    const title = editTitle.trim();
    if (!title || title.length > 200) {
      setActionNotice("Title must be 1 to 200 characters.");
      return;
    }

    setSavingId(editingId);
    setActionNotice("");
    try {
      await updateProjectRequest(editingId, accessToken, {
        title,
        description: editDescription.trim() || null,
        beginner_friendly: editBeginnerFriendly,
        skill_level: editSkillLevel || null
      });

      setProjects((current) =>
        current.map((project) =>
          project.id === editingId
            ? {
                ...project,
                title,
                description: editDescription.trim() || null,
                beginner_friendly: editBeginnerFriendly,
                skill_level: editSkillLevel || null
              }
            : project
        )
      );
      cancelEditing();
    } catch (error) {
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Unable to update project."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteProject(project: Project) {
    if (!accessToken || !authorId || deletingId) return;
    if (
      !window.confirm(
        `Delete "${project.title}"? This cannot be undone.`
      )
    )
      return;

    setDeletingId(project.id);
    setActionNotice("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || data.session.user.id !== authorId) {
        throw new Error("Please sign in again before deleting a post.");
      }
      const result = await deleteProjectRequest(project.id, data.session.access_token);
      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );
      setOpenMenuId(null);
      if (editingId === project.id) cancelEditing();
      if (!result.mediaCleanup) {
        setActionNotice(
          "Project deleted, but its image could not be removed."
        );
      }
    } catch (error) {
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Unable to delete project."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      className="project-feed"
      aria-labelledby="project-feed-title">
      <h2 id="project-feed-title">
        {title ?? (projectId ? "Project" : authorId ? "Your posts" : "Latest projects")}
      </h2>
      {!authorId && !projectId && (
        <div className="project-feed-filters" aria-label="Filter projects">
          <label className="collaboration-option">
            <input
              type="checkbox"
              checked={beginnerOnly}
              onChange={(event) => setBeginnerOnly(event.target.checked)}
            />
            <span>Beginner-friendly only</span>
          </label>
          <label className="project-skill-filter">
            <span>Experience required</span>
            <select
              value={skillFilter}
              onChange={(event) => setSkillFilter(event.target.value as SkillLevel | "")}>
              <option value="">Any experience</option>
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="collaboration-option">
            <input
              type="checkbox"
              checked={collaboratorsOnly}
              onChange={(event) => setCollaboratorsOnly(event.target.checked)}
            />
            <span>Looking for collaborators only</span>
          </label>
        </div>
      )}
      {status === "loading" && <p>Loading projects…</p>}
      {status === "error" && (
        <p role="alert">
          Unable to load projects. Check your connection and try
          again.
        </p>
      )}
      {status === "ready" && projects.length === 0 && (
        <p>
          {projectId
            ? "This project is unavailable or has been deleted."
            : beginnerOnly || skillFilter || collaboratorsOnly
              ? "No projects match these filters."
            : followedById
              ? "No projects from people you follow yet."
              : authorId
                ? "You haven’t shared any projects yet."
                  : "No projects yet."}
        </p>
      )}
      {actionNotice && <p role="alert">{actionNotice}</p>}
      {likesError && (
        <p role="alert">
          {likesError}{" "}
          <button type="button" onClick={() => setLikesRetry((value) => value + 1)}>
            Retry likes
          </button>
        </p>
      )}
      {status === "ready" && projects.length > 0 && (
        <div className="project-feed-list">
          {projects.map((project) => (
            <article
              className="project-feed-card"
              key={project.id}>
              {authorId && accessToken && authorId === userId && (
                <div className="project-card-actions">
                  <button
                    className="project-menu-trigger"
                    type="button"
                    aria-label={`Actions for ${project.title}`}
                    aria-expanded={openMenuId === project.id}
                    aria-controls={`project-menu-${project.id}`}
                    disabled={
                      deletingId !== null || savingId !== null
                    }
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === project.id
                          ? null
                          : project.id
                      )
                    }>
                    <span aria-hidden="true">⋯</span>
                  </button>
                  {openMenuId === project.id && (
                    <div
                      className="project-card-menu"
                      id={`project-menu-${project.id}`}>
                      <button
                        type="button"
                        onClick={() => startEditing(project)}>
                        Edit project
                      </button>
                      <button
                        type="button"
                        className="project-card-menu-delete"
                        disabled={deletingId !== null}
                        onClick={() =>
                          void deleteProject(project)
                        }>
                        {deletingId === project.id
                          ? "Deleting…"
                          : "Delete project"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {project.media_urls?.[0] && (
                <img
                  src={project.media_urls[0]}
                  alt={project.title}
                  loading="lazy"
                />
              )}
              <div className="project-feed-copy">
                <h3>{project.title}</h3>
                {userId && (
                  <LikeButton
                    projectId={project.id}
                    title={project.title}
                    userId={userId}
                    summary={likes[project.id]}
                    onChange={(summary) =>
                      setLikes((current) => ({ ...current, [project.id]: summary }))
                    }
                  />
                )}
                {!authorId && (
                  <Link
                    className="project-author-link"
                    to={`/profile/${project.author_id}`}>
                    {creatorNames[project.author_id]
                      ? `By @${creatorNames[project.author_id]}`
                      : "View creator profile"}
                  </Link>
                )}
                {project.looking_for_collaborators && (
                  <span className="project-collaboration-badge">
                    Looking for collaborators
                  </span>
                )}
                {project.beginner_friendly && (
                  <span className="project-beginner-badge">Beginner-friendly</span>
                )}
                {project.skill_level && (
                  <span className="project-skill-badge">
                    Experience required: {project.skill_level}
                  </span>
                )}
                <details className="project-details">
                  <summary>Project details</summary>
                  <p>{project.description || "No description provided."}</p>
                  <p>
                    Collaboration status:{" "}
                    {project.looking_for_collaborators
                      ? "Looking for help or collaborators"
                      : "Not currently looking"}
                  </p>
                </details>
                <time dateTime={project.created_at}>
                  {new Date(
                    project.created_at
                  ).toLocaleDateString()}
                </time>
                {session &&
                  project.author_id !== session.user.id &&
                  project.looking_for_collaborators && (
                    <CollaborationRequestForm
                      key={session.user.id}
                      projectId={project.id}
                      userId={session.user.id}
                    />
                  )}
                {authorId && accessToken && authorId === userId && (
                  <ProjectCollaborationToggle
                    projectId={project.id}
                    active={project.looking_for_collaborators}
                    disabled={deletingId !== null || savingId !== null}
                    onChange={(active) =>
                      setProjects((current) =>
                        current.map((item) =>
                          item.id === project.id
                            ? { ...item, looking_for_collaborators: active }
                            : item
                        )
                      )
                    }
                  />
                )}
                {editingId === project.id && (
                  <form
                    className="project-edit-form"
                    onSubmit={(event) =>
                      void saveProject(event)
                    }>
                    <label>
                      <span>Title</span>
                      <input
                        value={editTitle}
                        maxLength={200}
                        required
                        onChange={(event) =>
                          setEditTitle(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Description</span>
                      <textarea
                        value={editDescription}
                        onChange={(event) =>
                          setEditDescription(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Experience required</span>
                      <select
                        value={editSkillLevel}
                        onChange={(event) => setEditSkillLevel(event.target.value as SkillLevel | "")}>
                        <option value="">No specific experience</option>
                        {SKILL_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <label className="project-edit-checkbox">
                      <input
                        type="checkbox"
                        checked={editBeginnerFriendly}
                        onChange={(event) => setEditBeginnerFriendly(event.target.checked)}
                      />
                      <span>Beginner-friendly project</span>
                    </label>
                    <div className="project-edit-actions">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={savingId === project.id}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingId === project.id}>
                        {savingId === project.id
                          ? "Saving…"
                          : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
