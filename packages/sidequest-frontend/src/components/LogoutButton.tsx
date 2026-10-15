import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  async function handleLogout() {
    setBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setNotice(error.message);
      else navigate("/login", { replace: true });
    } catch {
      setNotice("Unable to log out. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="logout-control">
      <button
        type="button"
        className="site-button"
        disabled={busy}
        onClick={handleLogout}>
        {busy ? "Logging out…" : "Log out"}
      </button>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
