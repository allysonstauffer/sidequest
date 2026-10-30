import { useEffect, useState, type FormEvent } from "react";

import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { hasUsername } from "../auth/hasUsername";
import { isUsernameAvailable } from "../auth/usernameAvailability";
import InterestSkillPicker from "../components/InterestSkillPicker";
import { useHobbyCategories } from "../hobbies/useHobbyCategories";
import type { HobbyCategory } from "../hobbies/useHobbyCategories";

import type {
  Preference,
  PreferenceService
} from "../preferences/model";

import { supabasePreferenceService } from "../preferences/supabasePreferenceService";

import {
  usePreferences,
  usePreferenceDraft
} from "../preferences/usePreferences";
import { supabase } from "../lib/supabase";

interface Props {
  preferenceService?: PreferenceService;
}

export default function OnboardingPage({
  preferenceService = supabasePreferenceService
}: Props) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? "";
  const {
    categories,
    status: categoriesStatus,
    reload: reloadCategories
  } = useHobbyCategories();

  const { loading, data, error, reload } = usePreferences(
    userId,
    preferenceService
  );

  if (authLoading) {
    return <p role="status">Loading your account…</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!hasUsername(session.user)) {
    return <UsernameSetup key={userId} />;
  }

  if (loading) {
    return <p role="status">Loading your interests…</p>;
  }

  if (categoriesStatus === "loading") {
    return <p role="status">Loading hobby categories…</p>;
  }
  if (categoriesStatus === "error") {
    return (
      <section className="site-page">
        <p role="alert">
          Could not load hobby categories. Check that the hobby
          categories migration has been applied.
        </p>
        <button onClick={reloadCategories}>Try again</button>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="site-page">
        <p role="alert">
          {error ?? "Unable to load preferences."}
        </p>

        <button onClick={reload}>Try again</button>
      </section>
    );
  }

  return (
    <section className="site-page">
      <h1>Your interests</h1>

      <p>Choose your hobbies and your experience with each.</p>

      <OnboardingForm
        key={userId}
        initialPreferences={data.preferences}
        categories={categories}
        preferenceService={preferenceService}
      />
    </section>
  );
}

function UsernameSetup() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const value = username.trim();
    if (!value || value.length > 40) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(supabase, value);
        if (active) setStatus(available ? "available" : "taken");
      } catch {
        if (active) setStatus("error");
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [username]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = username.trim();
    if (!value || value.length > 40 || saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (!(await isUsernameAvailable(supabase, value))) {
        setStatus("taken");
        setNotice("That username is already taken.");
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { display_name: value }
      });
      if (error) {
        const available = await isUsernameAvailable(supabase, value);
        setNotice(available ? error.message : "That username is already taken.");
        if (!available) setStatus("taken");
      }
      // AuthProvider observes the updated user and renders the interests step.
    } catch {
      setNotice("Unable to save your username. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="site-page">
      <h1>Choose a username</h1>
      <p>This is how other Sidequest members will find you.</p>
      <form className="site-form" onSubmit={handleSubmit} aria-busy={saving}>
        <label>
          Username
          <input
            name="username"
            type="text"
            autoComplete="username"
            maxLength={40}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setStatus(event.target.value.trim() ? "checking" : "idle");
              setNotice("");
            }}
            required
          />
          {status === "checking" && <span role="status">Checking username…</span>}
          {status === "available" && <span role="status">Username available.</span>}
          {status === "taken" && <span role="status">Username already taken.</span>}
          {status === "error" && <span role="status">Could not check username. Try again.</span>}
        </label>
        {notice && <p className="site-notice" role="alert">{notice}</p>}
        <button
          type="submit"
          className="site-button site-button-primary"
          disabled={saving || status === "checking" || status === "taken"}>
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </section>
  );
}

function OnboardingForm({
  initialPreferences,
  categories,
  preferenceService
}: {
  initialPreferences: Preference[];
  categories: HobbyCategory[];
  preferenceService: PreferenceService;
}) {
  const navigate = useNavigate();

  const { selection, changeSelection, saving, error, save } =
    usePreferenceDraft(initialPreferences, preferenceService);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const saved = await save();

    if (saved) {
      navigate("/feed", { replace: true });
    }
  }

  return (
    <form
      className="site-form"
      aria-label="Hobby preferences"
      onSubmit={handleSubmit}
      aria-busy={saving}>
      <InterestSkillPicker
        value={selection}
        categories={categories}
        onChange={changeSelection}
        disabled={saving}
      />

      {error && (
        <p role="alert" className="site-notice">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="site-button site-button-primary"
        disabled={saving}>
        {saving ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
