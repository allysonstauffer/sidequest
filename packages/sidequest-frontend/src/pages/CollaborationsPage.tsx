import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import {
  saveCollaboration,
  type CollaborationRequest
} from "../lib/collaborationApi";
import "../components/Collaboration.css";

export default function CollaborationsPage() {
  const { session } = useAuth();
  return session ? (
    <CollaborationInbox
      key={session.user.id}
      userId={session.user.id}
    />
  ) : null;
}

function CollaborationInbox({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<
    CollaborationRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const current = ++sequence;
      try {
        const { data, error } = await supabase
          .from("collaboration_requests")
          .select("*")
          .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
          .order("created_at", { ascending: false })
          .order("id")
          .range(page * pageSize, page * pageSize + pageSize);
        if (error) throw error;
        if (active && current === sequence) {
          setRequests((data ?? []).slice(0, pageSize));
          setHasMore((data?.length ?? 0) > pageSize);
          setError("");
        }
      } catch {
        if (active && current === sequence)
          setError(
            "Could not load collaboration requests. Please retry."
          );
      } finally {
        if (active && current === sequence) setLoading(false);
      }
    }
    // Reconcile after subscription/reconnection so events during initial load
    // or an offline period are not lost. RLS limits events to participants.
    const channel = supabase
      .channel(`collaborations:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "collaboration_requests"
        },
        () => {
          void load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "collaboration_requests"
        },
        () => {
          void load();
        }
      )
      .subscribe((status) => {
        if (!active) return;
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void load();
      });
    void load();
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh, page]);

  async function respond(
    id: string,
    status: "accepted" | "declined"
  ) {
    if (saving.current) return;
    saving.current = true;
    setBusy(id);
    setNotice("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== userId)
        throw new Error("Please sign in again.");
      const result = await saveCollaboration(
        `/api/collaboration-requests/${encodeURIComponent(id)}/response`,
        { status },
        data.session.access_token
      );
      setRequests((current) =>
        current.map((request) =>
          request.id === id ? result : request
        )
      );
      setNotice(`Request ${result.status}.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not respond to the request."
      );
    } finally {
      saving.current = false;
      setBusy(null);
      setRefresh((value) => value + 1);
    }
  }

  function renderRequest(
    request: CollaborationRequest,
    incoming: boolean
  ) {
    return (
      <li key={request.id} className="collaboration-card">
        <h3>{request.project_title}</h3>
        <p>
          {incoming
            ? `From ${request.requester_name}`
            : `To ${request.owner_name}`}
        </p>
        <p className="collaboration-message">
          {request.message}
        </p>
        <p>
          Status: <strong>{request.status}</strong>
        </p>
        <time dateTime={request.created_at}>
          {new Date(request.created_at).toLocaleString()}
        </time>
        {incoming && request.status === "pending" && (
          <div className="collaboration-actions">
            <button
              disabled={busy !== null}
              onClick={() =>
                void respond(request.id, "accepted")
              }>
              Accept
            </button>
            <button
              disabled={busy !== null}
              onClick={() =>
                void respond(request.id, "declined")
              }>
              Decline
            </button>
            {busy === request.id && (
              <span role="status">Saving…</span>
            )}
          </div>
        )}
      </li>
    );
  }
  const incoming = requests.filter(
    (request) => request.owner_id === userId
  );
  const outgoing = requests.filter(
    (request) => request.requester_id === userId
  );
  return (
    <section className="collaboration-inbox">
      <h1>Collaborations</h1>
      <p>
        Review requests for your projects and track requests
        you’ve sent.
      </p>
      <p>
        Accepting confirms your interest in working together. It
        does not give anyone permission to edit your project.
      </p>
      <Link to="/feed">Find projects</Link>
      <p>
        {live
          ? "Live updates connected"
          : "Live updates unavailable. Use Refresh to check for changes."}
      </p>
      <button onClick={() => setRefresh((value) => value + 1)}>
        Refresh
      </button>
      {loading && <p role="status">Loading requests…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <h2>Received requests</h2>
      {!loading && !error && incoming.length === 0 && (
        <p>No received requests in this list.</p>
      )}
      <ul>
        {incoming.map((request) =>
          renderRequest(request, true)
        )}
      </ul>
      <h2>Sent requests</h2>
      {!loading && !error && outgoing.length === 0 && (
        <p>No sent requests in this list.</p>
      )}
      <ul>
        {outgoing.map((request) =>
          renderRequest(request, false)
        )}
      </ul>
      <div className="collaboration-actions">
        {page > 0 && (
          <button onClick={() => setPage((value) => value - 1)}>
            Newer requests
          </button>
        )}
        {hasMore && (
          <button onClick={() => setPage((value) => value + 1)}>
            Older requests
          </button>
        )}
      </div>
    </section>
  );
}
