import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { getAuthLinkError } from "../auth/authLinkError";

export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const [notice, setNotice] = useState(getAuthLinkError);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (
      password !== String(form.get("confirmPassword") ?? "")
    ) {
      setNotice("Passwords do not match.");
      return;
    }
    setNotice("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password
      });
      if (error) setNotice(error.message);
      else setComplete(true);
    } catch {
      setNotice(
        "Unable to update your password. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading…</p>;
  if (complete)
    return (
      <section className="site-page">
        <h1>Password updated</h1>
        <p role="status">Your new password has been saved.</p>
        <Link
          className="site-button site-button-primary"
          to="/feed">
          Continue to feed
        </Link>
      </section>
    );
  return (
    <section className="site-page">
      <h1>Reset password</h1>
      {session ? (
        <form className="site-form" onSubmit={handleSubmit}>
          <fieldset disabled={busy}>
            <label>
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <button
              type="submit"
              className="site-button site-button-primary">
              {busy ? "Saving…" : "Save password"}
            </button>
          </fieldset>
        </form>
      ) : (
        <p>
          Open the link from your password reset email to
          continue.
        </p>
      )}
      {notice && (
        <p className="site-notice" role="status">
          {notice}
        </p>
      )}
      <p>
        <Link className="site-text-link" to="/forgot-password">
          Request another reset link
        </Link>
      </p>
    </section>
  );
}
