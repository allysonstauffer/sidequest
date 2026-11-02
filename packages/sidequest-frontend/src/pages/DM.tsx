import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import DashboardLayout from "../components/DashboardLayout";
import { useUnreadMessages } from "../messages/useUnreadMessages";
import UnreadMessagesBadge from "../messages/UnreadMessagesBadge";
import "./DM.css";

type Contact = { id: string; username: string };
type Room = {
  id: string;
  name: string | null;
  created_at: string;
  participantIds: string[];
};
type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

function memberLabel(id: string, contacts: Contact[]) {
  return (
    contacts.find((contact) => contact.id === id)?.username ??
    `Member ${id.slice(0, 8)}`
  );
}

function roomLabel(
  room: Room,
  userId: string,
  contacts: Contact[]
) {
  if (room.name) return room.name;
  const otherMembers = room.participantIds.filter(
    (id) => id !== userId
  );
  return otherMembers.length
    ? otherMembers
        .map((id) => memberLabel(id, contacts))
        .join(", ")
    : "Chat";
}

function mergeMessages(...groups: Message[][]): Message[] {
  const byId = new Map<string, Message>();
  for (const group of groups) {
    for (const message of group) byId.set(message.id, message);
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  );
}

export default function DM() {
  const { session } = useAuth();
  const {
    roomCounts,
    revision,
    error: unreadError,
    refresh: refreshUnread,
    markRoomRead
  } = useUnreadMessages();
  const userId = session?.user.id ?? null;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [knownContacts, setKnownContacts] = useState<Contact[]>(
    []
  );
  const [usernameQuery, setUsernameQuery] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<
    string | null
  >(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<
    string | null
  >(null);
  const activeRoomIdRef = useRef(activeRoomId);
  const [messageState, setMessageState] = useState<{
    roomId: string | null;
    messages: Message[];
    loaded: boolean;
  }>({ roomId: null, messages: [], loaded: false });
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    []
  );
  const [roomName, setRoomName] = useState("");
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const creatingRef = useRef(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [readError, setReadError] = useState("");

  useEffect(() => {
    const field = draftRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    const query = usernameQuery.trim();
    if (query.length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setContactsLoading(true);
      const { data, error: searchError } = await supabase.rpc(
        "search_chat_users",
        { p_query: query }
      );
      if (!active) return;
      setContactsLoading(false);
      setContactsError(searchError?.message ?? null);
      if (!searchError) {
        const results = (data ?? []) as Contact[];
        setContacts(results);
        setKnownContacts((current) => {
          const byId = new Map(
            current.map((contact) => [contact.id, contact])
          );
          for (const contact of results)
            byId.set(contact.id, contact);
          return [...byId.values()];
        });
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [usernameQuery]);

  const refreshRooms = useCallback(async () => {
    if (!userId) return;
    const { data: memberships, error: membershipError } =
      await supabase
        .from("room_participants")
        .select("room_id")
        .eq("user_id", userId);
    if (membershipError) {
      setError(membershipError.message);
      setRoomsLoading(false);
      return;
    }
    const roomIds = (memberships ?? []).map(
      (row) => row.room_id
    );
    if (!roomIds.length) {
      setRooms([]);
      setActiveRoomId(null);
      setRoomsLoading(false);
      return;
    }
    const [roomResult, participantResult, nameResult] =
      await Promise.all([
        supabase
          .from("rooms")
          .select("id, name, created_at")
          .in("id", roomIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("room_participants")
          .select("room_id, user_id")
          .in("room_id", roomIds),
        supabase.rpc("chat_participant_names")
      ]);
    if (roomResult.error || participantResult.error) {
      setError(
        (roomResult.error ?? participantResult.error)
          ?.message ?? "Unable to load chats."
      );
      setRoomsLoading(false);
      return;
    }
    if (!nameResult.error) {
      setKnownContacts((current) => {
        const byId = new Map(
          current.map((contact) => [contact.id, contact])
        );
        for (const contact of (nameResult.data ??
          []) as Contact[]) {
          byId.set(contact.id, contact);
        }
        return [...byId.values()];
      });
    }
    const nextRooms = (roomResult.data ?? []).map((room) => ({
      ...room,
      participantIds: (participantResult.data ?? [])
        .filter(
          (participant) => participant.room_id === room.id
        )
        .map((participant) => participant.user_id)
    }));
    setRooms(nextRooms);
    setActiveRoomId((current) =>
      nextRooms.some((room) => room.id === current)
        ? current
        : (nextRooms[0]?.id ?? null)
    );
    setRoomsLoading(false);
  }, [userId]);

  useEffect(() => {
    // The first state update happens after the membership request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRooms();
  }, [refreshRooms, revision]);

  useEffect(() => {
    let active = true;
    if (!activeRoomId) return;
    let requestInFlight = false;
    async function loadMessages() {
      if (
        requestInFlight ||
        document.visibilityState === "hidden"
      )
        return;
      requestInFlight = true;
      try {
        const { data, error: historyError } = await supabase
          .from("messages")
          .select("id, room_id, sender_id, text, created_at")
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (!active) return;
        if (historyError) {
          setError(historyError.message);
        } else {
          setMessageState((current) => ({
            roomId: activeRoomId,
            messages: mergeMessages(
              current.roomId === activeRoomId
                ? current.messages
                : [],
              data ?? []
            ),
            loaded: true
          }));
        }
      } catch {
        if (active)
          setError(
            "Unable to load messages. Please try again."
          );
      } finally {
        requestInFlight = false;
      }
    }
    void loadMessages();
    const timer = window.setInterval(
      () => void loadMessages(),
      5000
    );
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void loadMessages();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [activeRoomId, revision]);

  useEffect(() => {
    if (
      !activeRoomId ||
      messageState.roomId !== activeRoomId ||
      !messageState.loaded
    )
      return;
    let active = true;
    const acknowledge = async () => {
      if (
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      )
        return;
      try {
        await markRoomRead(
          activeRoomId,
          messageState.messages.map((message) =>
            String(message.id)
          )
        );
        if (active) setReadError("");
      } catch (error) {
        if (active)
          setReadError(
            error instanceof Error
              ? error.message
              : "Could not mark this conversation as read."
          );
      }
    };
    void acknowledge();
    window.addEventListener("focus", acknowledge);
    document.addEventListener("visibilitychange", acknowledge);
    return () => {
      active = false;
      window.removeEventListener("focus", acknowledge);
      document.removeEventListener(
        "visibilitychange",
        acknowledge
      );
    };
  }, [activeRoomId, messageState, markRoomRead]);

  async function createChat() {
    if (creatingRef.current) return;
    setError(null);
    if (!selectedUsers.length) {
      setError("Select at least one person to chat with.");
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    try {
      const { data: roomId, error: createError } =
        await supabase.rpc("create_room", {
          p_member_ids: selectedUsers,
          p_name: roomName.trim() || null
        });
      if (createError) {
        setError(createError.message);
        return;
      }
      setRoomName("");
      setSelectedUsers([]);
      setActiveRoomId(roomId);
      await refreshRooms();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    const roomId = activeRoomId;
    if (!text || !roomId || !userId || sendingRef.current)
      return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const { data, error: sendError } = await supabase
        .from("messages")
        .insert({ room_id: roomId, sender_id: userId, text })
        .select("id, room_id, sender_id, text, created_at")
        .single();
      if (sendError) {
        setError(sendError.message);
        return;
      }
      if (activeRoomIdRef.current === roomId) {
        setMessageState((current) => ({
          roomId,
          messages: mergeMessages(
            current.roomId === roomId ? current.messages : [],
            [data]
          ),
          loaded: current.roomId === roomId && current.loaded
        }));
      }
      setDraft("");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const activeRoom = rooms.find(
    (room) => room.id === activeRoomId
  );
  const messages =
    messageState.roomId === activeRoomId
      ? messageState.messages
      : [];
  const historyLoading =
    Boolean(activeRoomId) &&
    (messageState.roomId !== activeRoomId ||
      !messageState.loaded);
  return (
    <DashboardLayout>
      <section className="dm" aria-labelledby="dm-title">
        <header className="page-header">
          <div>
            <p className="eyebrow">Messages</p>
            <h2 id="dm-title">Inbox</h2>
          </div>
        </header>
        {(unreadError || readError) && (
          <p className="dm-error" role="alert">
            {readError || unreadError}{" "}
            <button type="button" onClick={refreshUnread}>
              Retry
            </button>
          </p>
        )}
        <div className="dm-layout">
          <aside className="dm-sidebar">
            <h3>Start a chat</h3>
            <label htmlFor="dm-username">
              Search by username
            </label>
            <input
              id="dm-username"
              type="search"
              autoComplete="off"
              value={usernameQuery}
              placeholder="Enter at least 2 characters"
              disabled={creating}
              onChange={(event) => {
                setUsernameQuery(event.target.value);
                setContacts([]);
                setContactsError(null);
                setContactsLoading(
                  event.target.value.trim().length >= 2
                );
              }}
            />
            {usernameQuery.trim().length >= 2 &&
              contactsLoading && <p>Searching usernames…</p>}
            {usernameQuery.trim().length >= 2 &&
              !contactsLoading &&
              !contactsError &&
              contacts.length === 0 && (
                <p>No matching usernames found.</p>
              )}
            {contactsError && (
              <p role="alert">
                Could not search usernames: {contactsError}
              </p>
            )}
            {contacts.length > 0 && (
              <div
                className="dm-search-results"
                aria-label="Matching usernames">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="dm-search-result">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(
                        contact.id
                      )}
                      disabled={creating}
                      onChange={(event) =>
                        setSelectedUsers((current) =>
                          event.target.checked
                            ? [...current, contact.id]
                            : current.filter(
                                (id) => id !== contact.id
                              )
                        )
                      }
                    />
                    <span>{contact.username}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedUsers.length > 0 && (
              <div className="dm-selected-users">
                <span>Selected</span>
                {selectedUsers.map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={creating}
                    onClick={() =>
                      setSelectedUsers((current) =>
                        current.filter(
                          (selected) => selected !== id
                        )
                      )
                    }>
                    {memberLabel(id, knownContacts)} ×
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="dm-room-name">
              Chat name (optional)
            </label>
            <input
              id="dm-room-name"
              value={roomName}
              maxLength={80}
              disabled={creating}
              onChange={(event) =>
                setRoomName(event.target.value)
              }
            />
            <button
              type="button"
              disabled={creating || selectedUsers.length === 0}
              onClick={() => void createChat()}>
              {creating ? "Creating…" : "Create chat"}
            </button>
            <h3>Your chats</h3>
            {roomsLoading && <p>Loading chats…</p>}
            {!roomsLoading && rooms.length === 0 && (
              <p>No chats yet.</p>
            )}
            <nav
              aria-label="Your chats"
              className="dm-room-list">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  aria-current={
                    room.id === activeRoomId
                      ? "page"
                      : undefined
                  }
                  onClick={() => {
                    setError(null);
                    setActiveRoomId(room.id);
                  }}>
                  <span>
                    {roomLabel(
                      room,
                      userId ?? "",
                      knownContacts
                    )}
                  </span>
                  <UnreadMessagesBadge
                    count={roomCounts[room.id] ?? 0}
                  />
                </button>
              ))}
            </nav>
          </aside>
          <div className="dm-conversation">
            <h3>
              {activeRoom
                ? roomLabel(
                    activeRoom,
                    userId ?? "",
                    knownContacts
                  )
                : "Select a chat"}
            </h3>
            <div
              className="dm-messages"
              role="log"
              aria-label="Messages"
              aria-live="polite">
              {historyLoading && <p>Loading messages…</p>}
              {!historyLoading &&
                activeRoom &&
                messages.length === 0 && (
                  <p>No messages yet. Say hello!</p>
                )}
              {messages.map((message) => (
                <p
                  className={
                    message.sender_id === userId
                      ? "dm-message dm-message--own"
                      : "dm-message"
                  }
                  key={message.id}>
                  <strong>
                    {message.sender_id === userId
                      ? "You"
                      : memberLabel(
                          message.sender_id,
                          knownContacts
                        )}
                  </strong>
                  <span>{message.text}</span>
                  <time dateTime={message.created_at}>
                    {new Date(
                      message.created_at
                    ).toLocaleString()}
                  </time>
                </p>
              ))}
            </div>
            <form
              className="dm-compose"
              autoComplete="off"
              onSubmit={(event) => void sendMessage(event)}>
              <label className="dm-sr-only" htmlFor="dm-draft">
                Write a message
              </label>
              <textarea
                ref={draftRef}
                id="dm-draft"
                name="message"
                rows={1}
                autoComplete="off"
                enterKeyHint="send"
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Message…"
                disabled={!activeRoomId || sending}
              />
              <button
                type="submit"
                disabled={
                  !activeRoomId || !draft.trim() || sending
                }>
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
            {error && (
              <p className="dm-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
