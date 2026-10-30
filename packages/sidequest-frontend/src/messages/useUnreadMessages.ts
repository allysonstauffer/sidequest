import { createContext, useContext } from "react";

export const UnreadMessagesContext = createContext<{
  unreadCount: number;
  roomCounts: Record<string, number>;
  revision: number;
  error: string;
  refresh: () => void;
  markRoomRead: (
    roomId: string,
    messageIds: string[]
  ) => Promise<void>;
}>({
  unreadCount: 0,
  roomCounts: {},
  revision: 0,
  error: "",
  refresh: () => {},
  markRoomRead: async () => {}
});

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
