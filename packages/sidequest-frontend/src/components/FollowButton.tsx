import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type FollowButtonProps = {
  viewerId: string;
  targetId: string;
  onFollowChange?: () => void;
  followBack?: boolean;
  refreshKey?: number;
};

export default function FollowButton({
  viewerId,
  targetId,
  onFollowChange,
  followBack = false,
  refreshKey = 0
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadFollow() {
      setStatus("loading");
      try {
        const { data, error } = await supabase
          .from("user_follows")
          .select("followed_id")
          .eq("follower_id", viewerId)
          .eq("followed_id", targetId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!active) return;
        setIsFollowing(data !== null);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadFollow();
    return () => {
      active = false;
    };
  }, [targetId, viewerId, refreshKey, retry]);

  async function toggleFollow() {
    if (lock.current || status !== "ready") return;
    lock.current = true;
    setIsSaving(true);
    setNotice("");
    try {
      const result = isFollowing
        ? await supabase
            .from("user_follows")
            .delete()
            .eq("follower_id", viewerId)
            .eq("followed_id", targetId)
        : await supabase.from("user_follows").upsert(
            { follower_id: viewerId, followed_id: targetId },
            {
              onConflict: "follower_id,followed_id",
              ignoreDuplicates: true
            }
          );
      if (result.error) throw new Error(result.error.message);
      setIsFollowing((current) => !current);
      onFollowChange?.();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update follow status."
      );
    } finally {
      lock.current = false;
      setIsSaving(false);
    }
  }

  if (status === "loading") {
    return <p role="status">Checking follow status…</p>;
  }

  if (status === "error") {
    return (
      <div>
        <p role="alert">Could not check follow status.</p>
        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="site-button"
        type="button"
        aria-pressed={isFollowing}
        disabled={isSaving}
        onClick={() => void toggleFollow()}>
        {isSaving
          ? "Saving…"
          : isFollowing
            ? followBack
              ? "Following"
              : "Unfollow"
            : followBack
              ? "Follow back"
              : "Follow"}
      </button>
      {notice && <p role="alert">{notice}</p>}
    </div>
  );
}
