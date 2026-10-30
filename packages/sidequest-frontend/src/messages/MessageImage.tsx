import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MESSAGE_IMAGE_BUCKET } from "./chatMessages";

export default function MessageImage({
  path,
  sender
}: {
  path: string;
  sender: string;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await supabase.storage
          .from(MESSAGE_IMAGE_BUCKET)
          .createSignedUrl(path, 300);
        if (error || !data?.signedUrl)
          throw new Error("Image unavailable");
        if (active) {
          setUrl(data.signedUrl);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 240000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [path, retry]);
  if (error)
    return (
      <span className="dm-image-error">
        Photo unavailable.{" "}
        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      </span>
    );
  return url ? (
    <a
      className="dm-image-link"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open photo from ${sender}`}>
      <img
        className="dm-message-image"
        src={url}
        alt={`Photo from ${sender}`}
        loading="lazy"
        onError={() => setError(true)}
      />
    </a>
  ) : (
    <span role="status">Loading photo…</span>
  );
}
