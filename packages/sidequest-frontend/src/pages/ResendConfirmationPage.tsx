import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResendConfirmationPage() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: String(form.get("email") ?? "").trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
      setNotice(
        error
          ? error.message
          : "If your account needs confirmation, check your email for a new link."
      );
    } catch {
      setNotice(
        "Unable to send a confirmation link. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="site-page">
      <h1>Confirm your email</h1>
      <p>Request a new signup confirmation link.</p>
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
            {busy ? "Sending…" : "Resend confirmation"}
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
