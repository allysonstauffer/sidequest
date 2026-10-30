import { createContext, useContext } from "react";

export const NotificationsContext = createContext<{
  unreadCount: number;
  revision: number;
  connected: boolean;
  error: string;
  refresh: () => void;
  markRead: (id: string | null) => Promise<void>;
}>({
  unreadCount: 0,
  revision: 0,
  connected: false,
  error: "",
  refresh: () => {},
  markRead: async () => {}
});

export function useNotifications() {
  return useContext(NotificationsContext);
}
