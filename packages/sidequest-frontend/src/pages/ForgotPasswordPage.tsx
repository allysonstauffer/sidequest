import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice("");
    setBusy(true);
    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          String(form.get("email") ?? "").trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`
          }
        );
      setNotice(
        error
          ? error.message
          : "If an account exists for that email, you will receive a password reset link."
      );
    } catch {
      setNotice(
        "Unable to send a reset link. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="site-page">
      <h1>Forgot password?</h1>
      <p>Enter your email to receive a password reset link.</p>
      <form className="site-form" onSubmit={handleSubmit}>
        <fieldset disabled={busy}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <button
            type="submit"
            className="site-button site-button-primary">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </fieldset>
        {notice && (
          <p className="site-notice" role="status">
            {notice}
          </p>
        )}
      </form>
      <p>
        <Link className="site-text-link" to="/login">
          Back to login
        </Link>
      </p>
    </section>
  );
}
