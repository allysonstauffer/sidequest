import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Comments.css";

type Comment = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export default function Comments({
  kind,
  itemId,
  viewerId
}: {
  kind: "sidequest" | "project";
  itemId: string;
  viewerId: string;
}) {
  const table =
    kind === "sidequest"
      ? "sidequest_comments"
      : "project_comments";
  const itemIdColumn =
    kind === "sidequest" ? "sidequest_id" : "project_id";
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<
    Record<string, string>
  >({});
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadComments() {
      setStatus("loading");
      const result = await supabase
        .from(table)
        .select("id,author_id,body,created_at")
        .eq(itemIdColumn, itemId)
        .order("created_at", { ascending: true });

      if (!active) return;
      if (result.error) {
        setStatus("error");
        return;
      }

      const loaded = (result.data ?? []) as Comment[];
      const authorIds = [
        ...new Set(loaded.map((comment) => comment.author_id))
      ];
      if (authorIds.length > 0) {
        const profiles = await supabase
          .from("creator_profiles")
          .select("user_id,username")
          .in("user_id", authorIds);
        if (!active) return;
        if (!profiles.error) {
          setAuthors(
            Object.fromEntries(
              (profiles.data ?? [])
                .filter(
                  (profile) =>
                    typeof profile.username === "string"
                )
                .map((profile) => [
                  profile.user_id,
                  profile.username as string
                ])
            )
          );
        }
      }
      setComments(loaded);
      setStatus("ready");
    }

    void loadComments();
    return () => {
      active = false;
    };
  }, [open, reloadKey, table, itemIdColumn, itemId]);

  async function submitComment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setSubmitError("");

    const result = await supabase
      .from(table)
      .insert({
        [itemIdColumn]: itemId,
        author_id: viewerId,
        body
      })
      .select("id,author_id,body,created_at")
      .single();

    if (result.error || !result.data) {
      setSubmitError(
        "Could not post your comment. Please try again."
      );
    } else {
      setComments((current) => [
        ...current,
        result.data as Comment
      ]);
      setDraft("");
    }
    setSubmitting(false);
  }

  return (
    <section
      className="post-comments"
      aria-label={`${kind === "sidequest" ? "Sidequest" : "Project"} comments`}>
      <button
        className="post-comments-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={`${kind}-comments-${itemId}`}
        onClick={() => setOpen((current) => !current)}>
        Comments
        {status === "ready" ? ` (${comments.length})` : ""}
      </button>
      {open && (
        <div
          id={`${kind}-comments-${itemId}`}
          className="post-comments-content">
          {status === "loading" && (
            <p role="status">Loading comments…</p>
          )}
          {status === "error" && (
            <div role="alert">
              <p>Could not load comments.</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </button>
            </div>
          )}
          {status === "ready" && (
            <>
              {comments.length === 0 ? (
                <p className="post-comments-empty">
                  No comments yet. Start the conversation.
                </p>
              ) : (
                <ul className="post-comments-list">
                  {comments.map((comment) => (
                    <li key={comment.id}>
                      <div className="post-comment-meta">
                        <Link
                          to={`/profile/${comment.author_id}`}>
                          {authors[comment.author_id]
                            ? `@${authors[comment.author_id]}`
                            : comment.author_id === viewerId
                              ? "You"
                              : "Community member"}
                        </Link>
                        <time dateTime={comment.created_at}>
                          {new Date(
                            comment.created_at
                          ).toLocaleDateString()}
                        </time>
                      </div>
                      <p>{comment.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={(event) => void submitComment(event)}>
                <label
                  htmlFor={`${kind}-comment-input-${itemId}`}>
                  Add a comment
                </label>
                <textarea
                  id={`${kind}-comment-input-${itemId}`}
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value)
                  }
                  maxLength={2000}
                  rows={3}
                  placeholder="Ask a question or share feedback…"
                />
                {submitError && (
                  <p
                    role="alert"
                    className="post-comments-error">
                    {submitError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting || !draft.trim()}>
                  {submitting ? "Posting…" : "Post comment"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
