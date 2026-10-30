import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { AuthService } from "../auth/authService";
import { supabaseAuthService } from "../auth/supabaseAuthService";
import { useAuthForms } from "../auth/useAuthForms";
import { supabase } from "../lib/supabase";

type TotpFactor = {
  id: string;
  friendly_name?: string;
};

function TotpChallenge() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "loading" | "ready" | "verifying" | "verified" | "error"
  >("loading");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadFactors() {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (error) {
        setNotice(error.message);
        setStatus("error");
        return;
      }
      const totpFactors = data.totp.map((factor) => ({
        id: factor.id,
        friendly_name: factor.friendly_name
      }));
      if (totpFactors.length === 0) {
        setNotice("No verified authenticator was found for this account.");
        setStatus("error");
        return;
      }
      setFactors(totpFactors);
      setFactorId(totpFactors[0].id);
      setStatus("ready");
    }
    void loadFactors();
    return () => {
      active = false;
    };
  }, []);

  async function verifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || code.length !== 6 || status === "verifying") return;
    setStatus("verifying");
    setNotice("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code
    });
    if (error) {
      setNotice(
        error.status === 429
          ? "Too many attempts. Wait a moment and try again."
          : "That authentication code is invalid or expired."
      );
      setCode("");
      setStatus("ready");
      return;
    }
    setStatus("verified");
    setNotice("Code verified. Redirecting…");
  }

  async function signOutAndSwitchAccount() {
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <section className="site-page">
      <p className="site-eyebrow">Two-factor authentication</p>
      <h1>Enter your authentication code</h1>
      <p>Open your authenticator app and enter the current six digit code.</p>
      {status === "loading" ? (
        <p role="status">Loading your authenticator…</p>
      ) : status === "error" ? (
        <p className="site-notice" role="alert">{notice}</p>
      ) : (
        <form className="site-form" onSubmit={(event) => void verifyTotp(event)}>
          {factors.length > 1 && (
            <label>
              Authenticator
              <select
                value={factorId}
                disabled={status === "verifying" || status === "verified"}
                onChange={(event) => setFactorId(event.target.value)}>
                {factors.map((factor, index) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.friendly_name || `Authenticator ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Authentication code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              maxLength={6}
              disabled={status === "verifying" || status === "verified"}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setNotice("");
              }}
              autoFocus
              required
            />
          </label>
          <button
            type="submit"
            className="site-button site-button-primary"
            disabled={code.length !== 6 || status === "verifying" || status === "verified"}>
            {status === "verifying" ? "Verifying…" : "Verify code"}
          </button>
          {notice && <p className="site-notice" role="status">{notice}</p>}
        </form>
      )}
      <button
        type="button"
        className="site-button"
        disabled={status === "verifying" || status === "verified"}
        onClick={() => void signOutAndSwitchAccount()}>
        Use another account
      </button>
    </section>
  );
}

export default function LoginPage({
  authService = supabaseAuthService
}: {
  authService?: AuthService;
}) {
  const { session, loading, mfaStatus } = useAuth();
  const {
    pendingAction,
    loginNotice,
    signupNotice,
    confirmation,
    resendNotice,
    signIn,
    signUp,
    resendConfirmation,
    changeEmail
  } = useAuthForms(authService);
  const busy = pendingAction !== null;
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [googleNotice, setGoogleNotice] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const value = username.trim();
    if (!value) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const available = await authService.isUsernameAvailable(value);
        if (active) setUsernameStatus(available ? "available" : "taken");
      } catch {
        if (active) setUsernameStatus("error");
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authService, username]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await signIn({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    });
  }

  async function handleSignUp(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await signUp({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
      user: username.trim()
    });
  }

  async function handleGoogleSignIn() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleNotice("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/onboarding`
        }
      });
      if (error) {
        setGoogleNotice(error.message);
        setGoogleBusy(false);
      }
    } catch {
      setGoogleNotice("Unable to sign in with Google. Please try again.");
      setGoogleBusy(false);
    }
  }

  if (loading || (session && mfaStatus === "checking")) {
    return <p role="status">Checking your account…</p>;
  }
  if (session && mfaStatus === "required") {
    return <TotpChallenge />;
  }
  if (session && mfaStatus === "error") {
    return (
      <section className="site-page">
        <h1>Unable to verify account security</h1>
        <p role="alert">Please sign in again and retry.</p>
        <button
          type="button"
          className="site-button"
          onClick={() => void supabase.auth.signOut({ scope: "local" })}>
          Sign out
        </button>
      </section>
    );
  }
  if (session) return <Navigate to="/feed" replace />;
  return (
    <section className="site-page">
      <p className="site-eyebrow">Welcome!</p>
      <h1>Log in</h1>
      <button
        type="button"
        className="site-button"
        onClick={() => void handleGoogleSignIn()}
        disabled={busy || googleBusy}>
        {googleBusy ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {googleNotice && <p className="site-notice" role="alert">{googleNotice}</p>}
      <form
        className="site-form"
        onSubmit={handleSubmit}
        aria-busy={pendingAction === "signin"}
        aria-label="Log in">
        <fieldset disabled={busy}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              onChange={() => changeEmail("signin")}
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
            {pendingAction === "signin"
              ? "Logging in…"
              : "Log in"}
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
      <h2>Create an account</h2>
      <form
        className="site-form"
        onSubmit={handleSignUp}
        aria-busy={pendingAction === "signup"}
        aria-label="Sign up">
        <fieldset disabled={busy}>
          <label>
            Username
            <input
              name="user"
              type="text"
              autoComplete="username"
              value={username}
              maxLength={40}
              onChange={(event) => {
                setUsername(event.target.value);
                setUsernameStatus(event.target.value.trim() ? "checking" : "idle");
              }}
              required
            />
            {usernameStatus === "checking" && <span role="status">Checking username…</span>}
            {usernameStatus === "available" && <span role="status">Username available.</span>}
            {usernameStatus === "taken" && <span role="status">Username already taken.</span>}
            {usernameStatus === "error" && <span role="status">Could not check username. Try again.</span>}
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              onChange={() => changeEmail("signup")}
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
            className="site-button site-button-primary"
            disabled={usernameStatus === "taken" || usernameStatus === "checking"}>
            {pendingAction === "signup"
              ? "Creating account…"
              : "Sign up"}
          </button>
        </fieldset>
        {signupNotice && (
          <p className="site-notice" role="status">
            {signupNotice}
          </p>
        )}
      </form>
      {confirmation && (
        <div
          className="site-form"
          aria-label="Email confirmation">
          <p>
            Awaiting email confirmation for{" "}
            <strong>{confirmation.email}</strong>.
          </p>
          <button
            type="button"
            className="site-button"
            disabled={busy}
            aria-busy={pendingAction === "resend"}
            onClick={resendConfirmation}>
            {pendingAction === "resend"
              ? "Sending…"
              : confirmation.requested
                ? "Resend confirmation email"
                : "Send confirmation email"}
          </button>
          {resendNotice && (
            <p className="site-notice" role="status">
              {resendNotice}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
