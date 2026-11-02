import {
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { UnreadMessagesContext } from "./useUnreadMessages";
import { parseUnreadCounts } from "./unreadCounts";

export default function UnreadMessagesProvider({
  children
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  return session ? (
    <SignedInUnreadMessages
      key={session.user.id}
      userId={session.user.id}>
      {children}
    </SignedInUnreadMessages>
  ) : (
    <>{children}</>
  );
}

function SignedInUnreadMessages({
  userId,
  children
}: {
  userId: string;
  children: ReactNode;
}) {
  const [roomCounts, setRoomCounts] = useState<
    Record<string, number>
  >({});
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const refresh = useCallback(
    () => setRevision((value) => value + 1),
    []
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "get_message_unread_counts"
        );
        if (error) throw error;
        const counts = parseUnreadCounts(data);
        if (active) {
          setRoomCounts(counts);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Unread message count unavailable. Please retry."
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
      .channel(`unread-messages:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_receipts",
          filter: `recipient_id=eq.${userId}`
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_receipts",
          filter: `recipient_id=eq.${userId}`
        },
        refresh
      )
      .subscribe((status) => {
        if (active && status === "SUBSCRIBED") refresh();
      });
    const reconcile = () => {
      if (document.visibilityState === "visible") refresh();
    };
    // Reconcile missed/deleted events and support installations without Realtime.
    const timer = window.setInterval(reconcile, 15000);
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("online", reconcile);
      document.removeEventListener(
        "visibilitychange",
        reconcile
      );
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markRoomRead = useCallback(
    async (roomId: string, messageIds: string[]) => {
      if (!messageIds.length) return;
      const { data: auth, error: authError } =
        await supabase.auth.getSession();
      if (authError || auth.session?.user.id !== userId)
        throw new Error("Please sign in again.");
      const { data, error } = await supabase.rpc(
        "mark_room_messages_read",
        {
          p_room_id: String(roomId),
          p_message_ids: messageIds.map(String)
        }
      );
      if (error || !Number.isInteger(data) || data < 0)
        throw new Error(
          "Could not mark this conversation as read. Please retry."
        );
      if (data > 0) refresh();
    },
    [userId, refresh]
  );

  return (
    <UnreadMessagesContext.Provider
      value={{
        unreadCount: Object.values(roomCounts).reduce(
          (sum, count) => sum + count,
          0
        ),
        roomCounts,
        revision,
        error,
        refresh,
        markRoomRead
      }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}
