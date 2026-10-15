import {
  Navigate,
  Outlet
} from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import type { PreferenceService } from "../preferences/model";

import { supabasePreferenceService } from
  "../preferences/supabasePreferenceService";

import { usePreferences } from
  "../preferences/usePreferences";

interface Props {
  preferenceService?: PreferenceService;
}

export default function RequireOnboarding({
  preferenceService = supabasePreferenceService
}: Props) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? "";

  const { loading, data, error, reload } =
    usePreferences(userId, preferenceService);

  if (authLoading) {
    return <p role="status">Loading your account…</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <p role="status">Checking your profile…</p>;
  }

  if (error || !data) {
    return (
      <div>
        <p role="alert">
          {error ?? "Unable to check your profile."}
        </p>

        <button onClick={reload}>Try again</button>
      </div>
    );
  }

  if (!data.complete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
