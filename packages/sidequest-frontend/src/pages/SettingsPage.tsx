import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { isUsernameAvailable } from "../auth/usernameAvailability";
import "./SettingsPage.css";

function SettingsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const currentUsername = String(
    session?.user.user_metadata?.display_name ?? ""
  );
  const [username, setUsername] = useState(currentUsername);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [usernameNotice, setUsernameNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [deleteNotice, setDeleteNotice] = useState("");
  const [busy, setBusy] = useState<"username" | "password" | "delete" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    const value = username.trim();
    if (!value || value === currentUsername) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(supabase, value);
        if (active) setUsernameStatus(available ? "available" : "taken");
      } catch {
        if (active) setUsernameStatus("error");
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [username, currentUsername]);

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = username.trim();
    if (!nextUsername) {
      setUsernameNotice("Enter a username.");
      return;
    }
    if (nextUsername === currentUsername) {
      setUsernameNotice("Your username is already up to date.");
      return;
    }
    setBusy("username");
    setUsernameNotice("");
    try {
      if (!(await isUsernameAvailable(supabase, nextUsername))) {
        setUsernameNotice("That username is already taken.");
        setUsernameStatus("taken");
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { display_name: nextUsername }
      });
      if (error) {
        const stillAvailable = await isUsernameAvailable(supabase, nextUsername);
        setUsernameNotice(stillAvailable ? error.message : "That username is already taken.");
        if (!stillAvailable) setUsernameStatus("taken");
      } else {
        setUsername(nextUsername);
        setUsernameStatus("idle");
        setUsernameNotice("Username updated.");
      }
    } catch {
      setUsernameNotice("Unable to check or update your username. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword") ?? "");
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmPassword") ?? "");
    if (password !== confirmation) {
      setPasswordNotice("New passwords do not match.");
      return;
    }
    setBusy("password");
    setPasswordNotice("");
    try {
      const { error } = await supabase.auth.updateUser({
        current_password: currentPassword,
        password
      });
      if (error) {
        setPasswordNotice(
          error.code === "reauthentication_needed"
            ? "Please sign in again or use the password reset link, then retry."
            : error.message
        );
      } else {
        form.reset();
        setPasswordNotice("Password updated.");
      }
    } catch {
      setPasswordNotice("Unable to update your password. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || deleteConfirmation !== "DELETE") return;
    setBusy("delete");
    setDeleteNotice("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: deletePassword })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "Unable to delete your account. Try again."
        );
      }
      await supabase.auth.signOut({ scope: "local" });
      navigate("/login", { replace: true });
    } catch (error) {
      setDeleteNotice(
        error instanceof Error
          ? error.message
          : "Unable to delete your account. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardLayout>
      <main className="page-shell settings-page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Account settings</h2>
          </div>
        </div>

        <div className="settings-sections">
          <section className="settings-card" aria-labelledby="username-heading">
            <h3 id="username-heading">Username</h3>
            <p>This is the name shown on your profile and in chat.</p>
            <form onSubmit={(event) => void saveUsername(event)}>
              <label htmlFor="settings-username">Username</label>
              <input
                id="settings-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                maxLength={40}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setUsernameStatus(event.target.value.trim() ? "checking" : "idle");
                  setUsernameNotice("");
                }}
                required
              />
              {usernameStatus === "checking" && <span role="status">Checking username…</span>}
              {usernameStatus === "available" && <span role="status">Username available.</span>}
              {usernameStatus === "taken" && <span role="status">Username already taken.</span>}
              {usernameStatus === "error" && <span role="status">Could not check username. Try again.</span>}
              <button type="submit" disabled={busy !== null || usernameStatus === "taken" || usernameStatus === "checking"}>
                {busy === "username" ? "Saving…" : "Save username"}
              </button>
            </form>
            {usernameNotice && <p role="status">{usernameNotice}</p>}
          </section>

          <section className="settings-card" aria-labelledby="password-heading">
            <h3 id="password-heading">Password</h3>
            <p>Enter your current password to choose a new one.</p>
            <form onSubmit={(event) => void savePassword(event)}>
              <label htmlFor="settings-current-password">Current password</label>
              <input
                id="settings-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <label htmlFor="settings-new-password">New password</label>
              <input
                id="settings-new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <label htmlFor="settings-confirm-password">Confirm new password</label>
              <input
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button type="submit" disabled={busy !== null}>
                {busy === "password" ? "Saving…" : "Change password"}
              </button>
            </form>
            {passwordNotice && <p role="status">{passwordNotice}</p>}
            <Link to="/forgot-password">Forgot your password?</Link>
          </section>

          <section className="settings-card settings-danger" aria-labelledby="delete-heading">
            <h3 id="delete-heading">Delete account</h3>
            <p>This permanently removes your account. This action cannot be undone.</p>
            {!deleteOpen ? (
              <button
                type="button"
                className="settings-delete-button"
                onClick={() => setDeleteOpen(true)}>
                Delete account…
              </button>
            ) : (
              <form onSubmit={(event) => void deleteAccount(event)}>
                <label htmlFor="settings-delete-password">Current password</label>
                <input
                  id="settings-delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  required
                />
                <label htmlFor="settings-delete-confirmation">Type DELETE to confirm</label>
                <input
                  id="settings-delete-confirmation"
                  type="text"
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  required
                />
                <div className="settings-actions">
                  <button
                    type="submit"
                    className="settings-delete-button"
                    disabled={busy !== null || deleteConfirmation !== "DELETE"}>
                    {busy === "delete" ? "Deleting…" : "Permanently delete account"}
                  </button>
                  <button
                    type="button"
                    className="settings-cancel-button"
                    disabled={busy !== null}
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeletePassword("");
                      setDeleteConfirmation("");
                      setDeleteNotice("");
                    }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {deleteNotice && <p role="alert">{deleteNotice}</p>}
          </section>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default SettingsPage;
