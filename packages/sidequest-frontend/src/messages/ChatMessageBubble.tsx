import { useEffect, useState } from "react";
import MessageImage from "./MessageImage";
import {
  canUnsendMessage,
  UNSEND_WINDOW_MS,
  type ChatMessage
} from "./chatMessages";

export default function ChatMessageBubble({
  message,
  userId,
  senderName,
  onUnsend
}: {
  message: ChatMessage;
  userId: string;
  senderName: string;
  onUnsend: (message: ChatMessage) => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const own = message.sender_id === userId;

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const remaining =
      Date.parse(message.created_at) +
      UNSEND_WINDOW_MS -
      Date.now();
    const timer = window.setTimeout(
      refresh,
      Math.max(0, Math.min(remaining, UNSEND_WINDOW_MS))
    );
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [message.created_at]);

  async function unsend() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onUnsend(message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not unsend your message. Please try again."
      );
    } finally {
      setPending(false);
      setNow(Date.now());
    }
  }

  if (message.unsent_at)
    return (
      <div
        className={`dm-message-unsent${own ? " dm-message-unsent--own" : ""}`}>
        <span>
          {own
            ? "You unsent a message"
            : `${senderName} unsent a message`}
        </span>
      </div>
    );

  return (
    <div
      className={`dm-message${own ? " dm-message--own" : ""}`}>
      <strong>{own ? "You" : senderName}</strong>
      {message.image_path && (
        <MessageImage
          path={message.image_path}
          sender={own ? "you" : senderName}
        />
      )}
      <span>{message.text}</span>
      <time dateTime={message.created_at}>
        {new Date(message.created_at).toLocaleString()}
      </time>
      {canUnsendMessage(message, userId, now) && (
        <button
          className="dm-unsend-button"
          type="button"
          disabled={pending}
          title="Unsend for everyone within 2 minutes"
          aria-label="Unsend this message for everyone"
          onClick={() => void unsend()}>
          {pending ? "Unsending…" : "Undo send"}
        </button>
      )}
      {error && (
        <span className="dm-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
