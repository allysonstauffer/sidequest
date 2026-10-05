import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import ProfileGate from "./components/ProfileGate";
import heroImg from "./assets/hero.png";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import type { Session } from "@supabase/supabase-js";
import "./App.css";

export default function App() {
  // State management
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // INITIAL_SESSION restores the session; database work runs in ProfileGate.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // auth handlers
  async function signInWithGoogle() {
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (cause) {
      setAuthError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in with Google."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMessage(
            "Check your email to confirm your account. Once signed in, you can choose your username, display name, hobbies, and skill levels."
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });
        if (error) throw error;
      }
    } catch (cause) {
      setAuthError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  // Not logged in -> landing page with auth
  if (!session) {
    return (
      <section
        id="center"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem"
        }}>
        <div className="hero">
          <img
            src={heroImg}
            className="base"
            width="170"
            height="179"
            alt="Hero"
          />
          <img
            src={reactLogo}
            className="framework"
            alt="React logo"
          />
          <img
            src={viteLogo}
            className="vite"
            alt="Vite logo"
          />
        </div>

        <div>
          <h1>Welcome to SideQuest</h1>
          <p>
            {isSignUp
              ? "Create an account, then set up your username, display name, hobbies, and skill levels."
              : "Sign in to start exploring hobbies and communities."}
          </p>
        </div>

        <form
          onSubmit={handleEmailAuth}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            width: "100%",
            maxWidth: "300px"
          }}>
          {authError && (
            <div
              role="alert"
              style={{ color: "red", fontSize: "0.9rem" }}>
              {authError}
            </div>
          )}

          {authMessage && <p role="status">{authMessage}</p>}
          <input
            aria-label="Email address"
            autoComplete="email"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "0.5rem" }}
          />
          <input
            aria-label="Password"
            autoComplete={
              isSignUp ? "new-password" : "current-password"
            }
            minLength={isSignUp ? 6 : undefined}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "0.5rem" }}
          />

          <button type="submit" disabled={authLoading}>
            {authLoading
              ? "Processing..."
              : isSignUp
                ? "Create Account"
                : "Sign In with Email"}
          </button>
        </form>

        <button
          type="button"
          disabled={authLoading}
          style={{
            fontSize: "0.9rem",
            cursor: "pointer",
            textDecoration: "underline"
          }}
          onClick={() => {
            setIsSignUp(!isSignUp);
            setAuthError("");
            setAuthMessage("");
          }}>
          {isSignUp
            ? "Already have an account? Sign In"
            : "Don't have an account? Sign Up"}
        </button>

        <hr
          style={{
            width: "100%",
            maxWidth: "300px",
            opacity: 0.2
          }}
        />

        <button
          type="button"
          className="counter"
          disabled={authLoading}
          onClick={signInWithGoogle}
          style={{ width: "100%", maxWidth: "300px" }}>
          Sign in with Google
        </button>
      </section>
    );
  }

  return (
    <ProfileGate key={session.user.id} user={session.user} />
  );
}
