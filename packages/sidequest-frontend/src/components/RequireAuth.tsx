import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function RequireAuth() {
  const { session, loading } = useAuth();

  if (loading) {
    return <p>Loading…</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
