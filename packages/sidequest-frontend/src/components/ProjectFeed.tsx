import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadFollowedAuthorIds } from "../utils/followedProjectAuthors";
import "./ProjectFeed.css";

type Project = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  media_urls: string[] | null;
  created_at: string;
};

type ProjectFeedProps = {
  authorId?: string;
  followedById?: string;
  accessToken?: string;
  title?: string;
};

function parseProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;

  const project = value as Record<string, unknown>;
  if (
    typeof project.id !== "string" ||
    typeof project.author_id !== "string" ||
    typeof project.title !== "string" ||
    typeof project.created_at !== "string" ||
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
    created_at: project.created_at
  };
}

export default function ProjectFeed({
  authorId,
  followedById,
  accessToken,
  title
}: ProjectFeedProps) {
  const [projects, setProjects] = useState<Project[]>([]);
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
            setStatus("ready");
            return;
          }
        }

        let query = supabase
          .from("projects")
          .select(
            "id,author_id,title,description,media_urls,created_at"
          )
          .order("created_at", { ascending: false });
        if (authorId) query = query.eq("author_id", authorId);
        if (followedAuthorIds) {
          query = query.in("author_id", followedAuthorIds);
        }
        if (!authorId && !followedById) query = query.limit(20);
        const { data, error } = await query;
        if (error) throw new Error(error.message);

        if (!active) return;
        setProjects(
          (data ?? [])
            .map(parseProject)
            .filter(
              (project): project is Project => project !== null
            )
        );
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadProjects();
    return () => {
      active = false;
    };
  }, [authorId, followedById]);

  function startEditing(project: Project) {
    setOpenMenuId(null);
    setEditingId(project.id);
    setEditTitle(project.title);
    setEditDescription(project.description ?? "");
    setActionNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
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
      const response = await fetch(
        `/api/upload?id=${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            description: editDescription.trim() || null
          })
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "Unable to update project."
        );
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === editingId
            ? {
                ...project,
                title,
                description: editDescription.trim() || null
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
      const response = await fetch(
        `/api/upload?id=${encodeURIComponent(project.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "nope"
        );
      }
      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );
      setOpenMenuId(null);
      if (editingId === project.id) cancelEditing();
      if (result?.media_cleanup === false) {
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
        {title ?? (authorId ? "My Projects" : "Projects")}
      </h2>
      {status === "loading" && <p>Loading projects…</p>}
      {status === "error" && (
        <p role="alert">
          Unable to load projects. Check your connection and try
          again.
        </p>
      )}
      {status === "ready" && projects.length === 0 && (
        <p>
          {followedById
            ? "No projects from people you follow yet."
            : authorId
              ? "You haven’t shared any projects yet."
              : "No projects yet."}
        </p>
      )}
      {actionNotice && <p role="alert">{actionNotice}</p>}
      {status === "ready" && projects.length > 0 && (
        <div className="project-feed-list">
          {projects.map((project) => (
            <article
              className="project-feed-card"
              key={project.id}>
              {authorId && accessToken && (
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
                {!authorId && (
                  <Link
                    className="project-author-link"
                    to={`/profile/${project.author_id}`}>
                    View creator profile
                  </Link>
                )}
                {project.description && (
                  <p>{project.description}</p>
                )}
                <time dateTime={project.created_at}>
                  {new Date(
                    project.created_at
                  ).toLocaleDateString()}
                </time>
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
