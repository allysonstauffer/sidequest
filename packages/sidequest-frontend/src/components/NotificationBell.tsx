import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../notifications/useNotifications";
import "../notifications/Notifications.css";

export default function NotificationBell() {
  const { unreadCount, error } = useNotifications();
  return (
    <Link
      to="/notifications"
      className="notification-bell"
      aria-label={`Notifications${error ? ", unavailable" : unreadCount ? `, ${unreadCount} unread` : ""}`}>
      <Bell size={23} aria-hidden="true" />
      <span>Notifications</span>
      {unreadCount > 0 && (
        <span className="notification-count" aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {error && <span aria-hidden="true">!</span>}
    </Link>
  );
}
