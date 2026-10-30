import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext, type MfaStatus } from "./useAuth";

export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] =
    useState<MfaStatus>("checking");
  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setMfaStatus(nextSession ? "checking" : "satisfied");
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) {
      return () => {
        active = false;
      };
    }

    async function checkMfa() {
      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
          session?.access_token
        );
      if (!active) return;
      if (error) {
        setMfaStatus("error");
        return;
      }
      setMfaStatus(
        data.currentLevel === "aal1" && data.nextLevel === "aal2"
          ? "required"
          : "satisfied"
      );
    }
    void checkMfa();
    return () => {
      active = false;
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, loading, mfaStatus }}>
      {children}
    </AuthContext.Provider>
  );
}
