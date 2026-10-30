import {
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  saveCollaboration,
  type CollaborationRequest
} from "../lib/collaborationApi";
import "./Collaboration.css";

export default function CollaborationRequestForm({
  projectId,
  userId
}: {
  projectId: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="collaboration-request">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}>
        {open ? "Close request form" : "Request collaboration"}
      </button>
      {open && (
        <RequestForm
          key={`${projectId}:${userId}`}
          projectId={projectId}
          userId={userId}
        />
      )}
    </div>
  );
}

function RequestForm({
  projectId,
  userId
}: {
  projectId: string;
  userId: string;
}) {
  const [existing, setExisting] =
    useState<CollaborationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("collaboration_requests")
          .select("*")
          .eq("project_id", projectId)
          .eq("requester_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (active) setExisting(data);
      } catch {
        if (active)
          setError(
            "Could not check existing requests. Close this form and try again."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, userId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !message.trim()) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== userId)
        throw new Error("Please sign in again.");
      const result = await saveCollaboration(
        `/api/projects/${encodeURIComponent(projectId)}/collaboration-requests`,
        { message: message.trim() },
        data.session.access_token
      );
      setExisting(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not send your request."
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  if (loading)
    return <p role="status">Checking your request…</p>;
  if (existing)
    return (
      <p role="status">
        Request {existing.status}.{" "}
        <Link to="/collaborations">View collaborations</Link>
      </p>
    );
  return (
    <form onSubmit={submit}>
      <label htmlFor={`request-message-${projectId}`}>
        How would you like to help?
      </label>
      <textarea
        id={`request-message-${projectId}`}
        required
        maxLength={1000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={saving}
      />
      <p>
        One request per project. Your message is shared with the
        project owner.
      </p>
      <button
        type="submit"
        disabled={saving || !message.trim()}>
        {saving ? "Sending…" : "Send request"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
