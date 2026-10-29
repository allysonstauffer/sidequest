import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { deleteProject as deleteProjectRequest } from "../lib/projectApi";
import "./ProjectFeed.css";

type Project = {
  id: string;
  title: string;
  description: string | null;
  media_urls: string[] | null;
  created_at: string;
};

type ProjectFeedProps = {
  authorId?: string;
  accessToken?: string;
};

export default function ProjectFeed({
  authorId,
  accessToken
}: ProjectFeedProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [deleteNotice, setDeleteNotice] = useState("");

  const PUBLIC_FEED_LIMIT = 20;
  
  useEffect(() => {
    let active = true;

    async function loadProjects() {
      try {
        let query = supabase
          .from("projects")
          .select("id,title,description,media_urls,created_at");
        if (authorId) query = query.eq("author_id", authorId);
        query = query.order("created_at", { ascending: false })
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
  }, [authorId]);

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
      {status === "loading" && <p>Loading projects…</p>}
      {status === "error" && (
        <p role="alert">
          Could not load posts. Please refresh and try again.
        </p>
      )}
      {status === "ready" && projects.length === 0 && (
        <p>{authorId ? "share some posts" : "no posts yet"}</p>
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
                {project.description && (
                  <p>{project.description}</p>
                )}
                <time dateTime={project.created_at}>
                  {new Date(
                    project.created_at
                  ).toLocaleDateString()}
                </time>
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
