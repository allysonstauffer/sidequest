import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export type MfaStatus =
  | "checking"
  | "required"
  | "satisfied"
  | "error";

export const AuthContext = createContext<
  | {
      session: Session | null;
      loading: boolean;
      mfaStatus: MfaStatus;
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
