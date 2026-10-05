import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export const AuthContext = createContext<
  | {
      session: Session | null;
      loading: boolean;
    }
  | undefined
>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  return context;
}
