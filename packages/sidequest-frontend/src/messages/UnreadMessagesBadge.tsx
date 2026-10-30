import { useUnreadMessages } from "./useUnreadMessages";
import "./UnreadMessages.css";

export default function UnreadMessagesBadge({
  count
}: {
  count?: number;
}) {
  const { unreadCount } = useUnreadMessages();
  const value = count ?? unreadCount;
  return value > 0 ? (
    <span
      className="unread-messages-badge"
      aria-label={`${value} unread ${value === 1 ? "message" : "messages"}`}>
      {value > 99 ? "99+" : value}
    </span>
  ) : null;
}
