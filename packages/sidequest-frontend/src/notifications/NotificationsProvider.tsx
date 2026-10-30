import {
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { NotificationsContext } from "./useNotifications";

export default function NotificationsProvider({
  children
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  return session ? (
    <SignedInNotifications
      key={session.user.id}
      userId={session.user.id}>
      {children}
    </SignedInNotifications>
  ) : (
    <>{children}</>
  );
}

function SignedInNotifications({
  userId,
  children
}: {
  userId: string;
  children: ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(
    () => setRevision((value) => value + 1),
    []
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .is("read_at", null)
          .is("dismissed_at", null);
        if (error) throw error;
        if (active) {
          setUnreadCount(count ?? 0);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Could not load notifications. Please refresh to retry."
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, revision]);

  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`
        },
        refresh
      )
      .subscribe((status) => {
        if (!active) return;
        setConnected(status === "SUBSCRIBED");
        // Reconcile any events missed while connecting or offline.
        if (status === "SUBSCRIBED") refresh();
      });
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  async function markRead(id: string | null) {
    const { data: auth, error: authError } =
      await supabase.auth.getSession();
    if (authError || auth.session?.user.id !== userId)
      throw new Error("Please sign in again.");
    const { data, error } = await supabase.rpc(
      "mark_notifications_read",
      { p_notification_id: id }
    );
    if (error)
      throw new Error(
        "Could not mark notifications as read. Please try again."
      );
    if (!Number.isInteger(data) || data < 0)
      throw new Error("The server did not confirm the change.");
    refresh();
  }

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        revision,
        connected,
        error,
        refresh,
        markRead
      }}>
      {children}
    </NotificationsContext.Provider>
  );
}
