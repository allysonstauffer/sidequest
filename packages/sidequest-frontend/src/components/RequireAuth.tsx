import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function RequireAuth() {
  const { session, loading, mfaStatus } = useAuth();

  if (loading || (session && mfaStatus === "checking")) {
    return <p>Loading…</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (mfaStatus === "required" || mfaStatus === "error") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
