import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { useNotifications } from "../notifications/useNotifications";
import { Heart } from "lucide-react";
import "../notifications/Notifications.css";

type Notification = {
  id: string;
  actor_name: string;
  project_title: string;
  project_id: string;
  created_at: string;
  read_at: string | null;
};

export default function NotificationsPage() {
  const { session } = useAuth();
  return session ? (
    <NotificationList
      key={session.user.id}
      userId={session.user.id}
    />
  ) : null;
}

function NotificationList({ userId }: { userId: string }) {
  const {
    revision,
    connected,
    refresh,
    markRead,
    unreadCount,
    error: countError
  } = useNotifications();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select(
            "id, actor_name, project_title, project_id, created_at, read_at"
          )
          .eq("recipient_id", userId)
          .is("dismissed_at", null)
          .order("created_at", { ascending: false })
          .order("id")
          .range(page * 30, page * 30 + 30);
        if (error) throw error;
        if (active) {
          setItems((data ?? []).slice(0, 30));
          setHasMore((data?.length ?? 0) > 30);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Could not load notifications. Please refresh to retry."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, revision, page]);

  async function read(item: Notification | null, open = false) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setActionError("");
    try {
      await markRead(item?.id ?? null);
      if (item && open)
        navigate(`/projects/${item.project_id}`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not mark this notification as read."
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="notifications-page">
      <h1>Notifications</h1>
      <p>See who liked your projects.</p>
      <div className="notifications-actions">
        <button onClick={refresh}>Refresh</button>
        <button
          disabled={saving || unreadCount === 0}
          onClick={() => void read(null)}>
          Mark all as read
        </button>
      </div>
      {!connected && (
        <p className="notifications-status">
          Live updates are reconnecting. You can refresh to
          check for new likes.
        </p>
      )}
      {loading && <p role="status">Loading notifications…</p>}
      {(error || countError) && (
        <p role="alert">{error || countError}</p>
      )}
      {actionError && <p role="alert">{actionError}</p>}
      {!loading && !error && items.length === 0 && (
        <p>No notifications here yet.</p>
      )}
      <ul className="notifications-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`notification-item${item.read_at ? "" : " is-unread"}`}>
            <Heart
              className="notification-heart"
              size={22}
              fill="currentColor"
              aria-hidden="true"
            />
            <div>
              <button
                className="notification-open"
                disabled={saving}
                onClick={() => void read(item, true)}>
                <strong>{item.actor_name}</strong> liked your
                project <strong>{item.project_title}</strong>.
              </button>
              <time dateTime={item.created_at}>
                {new Date(item.created_at).toLocaleString()}
              </time>
              {!item.read_at && (
                <button
                  className="notification-read"
                  disabled={saving}
                  onClick={() => void read(item)}>
                  Mark as read
                </button>
              )}
            </div>
            {!item.read_at && (
              <span
                className="notification-dot"
                aria-label="Unread"
              />
            )}
          </li>
        ))}
      </ul>
      <div className="notifications-actions">
        {page > 0 && (
          <button onClick={() => setPage((value) => value - 1)}>
            Newer notifications
          </button>
        )}
        {hasMore && (
          <button onClick={() => setPage((value) => value + 1)}>
            Older notifications
          </button>
        )}
      </div>
    </main>
  );
}
