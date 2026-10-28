import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type FollowButtonProps = {
  viewerId: string;
  targetId: string;
};

export default function FollowButton({
  viewerId,
  targetId
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

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
  }, [targetId, viewerId]);

  async function toggleFollow() {
    if (isSaving) return;
    setIsSaving(true);
    setNotice("");
    try {
      const result = isFollowing
        ? await supabase
            .from("user_follows")
            .delete()
            .eq("follower_id", viewerId)
            .eq("followed_id", targetId)
        : await supabase.from("user_follows").insert({
            follower_id: viewerId,
            followed_id: targetId
          });
      if (result.error) throw new Error(result.error.message);
      setIsFollowing((current) => !current);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update follow status."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (status === "loading") {
    return <p role="status">Checking follow status…</p>;
  }

  if (status === "error") {
    return (
      <p role="alert">
        Could not load follow status. Check that the follow
        migration has been applied.
      </p>
    );
  }

  return (
    <div>
      <button
        className="site-button"
        type="button"
        disabled={isSaving}
        onClick={() => void toggleFollow()}>
        {isSaving
          ? "Saving…"
          : isFollowing
            ? "Unfollow"
            : "Follow"}
      </button>
      {notice && <p role="alert">{notice}</p>}
    </div>
  );
}
