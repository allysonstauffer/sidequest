import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { getAuthLinkError } from "../auth/authLinkError";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [loginNotice, setLoginNotice] =
    useState(getAuthLinkError);
  const [signupNotice, setSignupNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginNotice("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? "")
      });
      if (error) setLoginNotice(error.message);
    } catch {
      setLoginNotice("Unable to log in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setSignupNotice("");
    if (
      password !== String(form.get("confirmPassword") ?? "")
    ) {
      setSignupNotice("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: String(form.get("email") ?? "").trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
      if (error) setSignupNotice(error.message);
      else if (!data.session)
        setSignupNotice(
          "Check your email for a confirmation link. If you already have an account, log in instead."
        );
    } catch {
      setSignupNotice("Unable to sign up. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading…</p>;
  if (session) return <Navigate to="/feed" replace />;
  return (
    <section className="site-page">
      <p className="site-eyebrow">Welcome!</p>
      <h1>Log in</h1>
      <form
        className="site-form"
        onSubmit={handleSubmit}
        aria-label="Log in">
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
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            type="submit"
            className="site-button site-button-primary">
            {busy ? "Please wait…" : "Log in"}
          </button>
        </fieldset>
        {loginNotice && (
          <p className="site-notice" role="status">
            {loginNotice}
          </p>
        )}
      </form>
      <p>
        <Link to="/forgot-password" className="site-text-link">
          Forgot password?
        </Link>
      </p>
      <p>
        <Link
          to="/resend-confirmation"
          className="site-text-link">
          Resend confirmation email
        </Link>
      </p>
      <h2>Create an account</h2>
      <form
        className="site-form"
        onSubmit={handleSignUp}
        aria-label="Sign up">
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
          <label>
            Password
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
            {busy ? "Please wait…" : "Sign up"}
          </button>
        </fieldset>
        {signupNotice && (
          <p className="site-notice" role="status">
            {signupNotice}
          </p>
        )}
      </form>
    </section>
  );
}
