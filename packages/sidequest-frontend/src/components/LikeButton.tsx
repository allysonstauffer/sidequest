import { useRef, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "../lib/supabase";
import { saveLike, type LikeSummary } from "../lib/likesApi";
import "./Likes.css";

export default function LikeButton({
  projectId,
  title,
  userId,
  summary,
  onChange
}: {
  projectId: string;
  title: string;
  userId: string;
  summary: LikeSummary | undefined;
  onChange: (summary: LikeSummary) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function toggle() {
    if (lock.current || !summary) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== userId)
        throw new Error(
          "Please sign in again to like this project."
        );
      onChange(
        await saveLike(
          projectId,
          !summary.liked,
          data.session.access_token
        )
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save your like."
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="project-like">
      <div className="project-like-row">
        <button
          type="button"
          className={`project-like-button${summary?.liked ? " is-liked" : ""}`}
          aria-label={`${summary?.liked ? "Unlike" : "Like"} ${title}`}
          aria-pressed={summary?.liked ?? false}
          disabled={saving || !summary}
          onClick={() => void toggle()}>
          <Heart
            size={25}
            strokeWidth={1.8}
            fill={summary?.liked ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
        <span aria-live="polite">
          {summary
            ? `${summary.like_count} ${summary.like_count === 1 ? "like" : "likes"}`
            : "Likes unavailable"}
        </span>
        {saving && (
          <span className="like-saving" role="status">
            Saving…
          </span>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
