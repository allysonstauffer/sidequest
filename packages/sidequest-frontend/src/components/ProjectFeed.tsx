import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { deleteProject as deleteProjectRequest } from "../lib/projectApi";
import ProjectCollaborationToggle from "./ProjectCollaborationToggle";
import CollaborationRequestForm from "./CollaborationRequestForm";
import { useAuth } from "../auth/useAuth";
import "./ProjectFeed.css";

type Project = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  media_urls: string[] | null;
  created_at: string;
  looking_for_collaborators: boolean;
};

type ProjectFeedProps = {
  authorId?: string;
  accessToken?: string;
};

export default function ProjectFeed({
  authorId,
  accessToken
}: ProjectFeedProps) {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [deleteNotice, setDeleteNotice] = useState("");
  const [collaboratorsOnly, setCollaboratorsOnly] =
    useState(false);

  const PUBLIC_FEED_LIMIT = 20;

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      try {
        let query = supabase.from("projects").select(`
            id,
            author_id,
            title,
            description,
            media_urls,
            created_at,
            looking_for_collaborators
          `);
        if (authorId) query = query.eq("author_id", authorId);
        // Filter on the server before limiting the public feed to 20 results.
        if (!authorId && collaboratorsOnly) {
          query = query.eq("looking_for_collaborators", true);
        }
        query = query.order("created_at", { ascending: false });
        const { data, error } = await (authorId
          ? query
          : query.limit(PUBLIC_FEED_LIMIT));

        if (!active) return;
        if (error) {
          setStatus("error");
          return;
        }
        setProjects(data ?? []);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadProjects();
    return () => {
      active = false;
    };
  }, [authorId, collaboratorsOnly]);

  async function deleteProject(project: Project) {
    if (!accessToken || !authorId || deletingId) return;
    if (
      !window.confirm(
        `Delete "${project.title}"? This cannot be undone.`
      )
    )
      return;

    setDeletingId(project.id);
    setDeleteNotice("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (
        error ||
        !data.session ||
        data.session.user.id !== authorId
      ) {
        throw new Error(
          "Please sign in again before deleting a post."
        );
      }
      const result = await deleteProjectRequest(
        project.id,
        data.session.access_token
      );
      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );
      if (!result.mediaCleanup) {
        setDeleteNotice(
          "Your post was deleted, but its image could not be removed."
        );
      }
    } catch (error) {
      setDeleteNotice(
        error instanceof Error
          ? error.message
          : "Could not delete your post. Please try again."
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
        {authorId ? "Your posts" : "Latest projects"}
      </h2>
      {!authorId && (
        <label className="collaboration-option">
          <input
            type="checkbox"
            checked={collaboratorsOnly}
            onChange={(event) => {
              setStatus("loading");
              setCollaboratorsOnly(event.target.checked);
            }}
          />
          <span>Looking for collaborators only</span>
        </label>
      )}
      {status === "loading" && <p>Loading projects…</p>}
      {status === "error" && (
        <p role="alert">
          Could not load posts. Please refresh and try again.
        </p>
      )}
      {status === "ready" && projects.length === 0 && (
        <p>
          {authorId
            ? "You haven’t shared any projects yet."
            : collaboratorsOnly
              ? "No projects are looking for collaborators yet."
              : "No projects yet."}
        </p>
      )}
      {deleteNotice && <p role="alert">{deleteNotice}</p>}
      {status === "ready" && projects.length > 0 && (
        <div className="project-feed-list">
          {projects.map((project) => (
            <article
              className="project-feed-card"
              key={project.id}>
              {project.media_urls?.[0] && (
                <img
                  src={project.media_urls[0]}
                  alt={project.title}
                  loading="lazy"
                />
              )}
              <div className="project-feed-copy">
                <h3>{project.title}</h3>
                {project.looking_for_collaborators && (
                  <span className="project-collaboration-badge">
                    Looking for collaborators
                  </span>
                )}
                <details className="project-details">
                  <summary>Project details</summary>
                  <p>
                    {project.description ||
                      "No description provided."}
                  </p>
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
                {authorId && accessToken && (
                  <ProjectCollaborationToggle
                    projectId={project.id}
                    active={project.looking_for_collaborators}
                    disabled={deletingId !== null}
                    onChange={(active) => {
                      setProjects((current) =>
                        current.map((item) =>
                          item.id === project.id
                            ? {
                                ...item,
                                looking_for_collaborators:
                                  active
                              }
                            : item
                        )
                      );
                    }}
                  />
                )}
                {authorId && accessToken && (
                  <button
                    className="project-delete-button"
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => void deleteProject(project)}>
                    {deletingId === project.id
                      ? "deleting"
                      : "delete?"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
