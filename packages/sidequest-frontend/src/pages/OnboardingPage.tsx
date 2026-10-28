import type { FormEvent } from "react";

import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
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
