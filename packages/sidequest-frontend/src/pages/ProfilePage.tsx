import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { HOBBIES } from "../preferences/model";
import type { PreferenceService } from "../preferences/model";
import { supabasePreferenceService } from "../preferences/supabasePreferenceService";
import { usePreferences } from "../preferences/usePreferences";

interface Props {
  preferenceService?: PreferenceService;
}

function ProfilePage({
  preferenceService = supabasePreferenceService
}: Props) {
  const { session, loading: authLoading } = useAuth();
  const { loading, data, error, reload } = usePreferences(
    session?.user.id ?? "",
    preferenceService
  );

  if (authLoading) {
    return <p role="status">Loading your account…</p>;
  }

  if (!session) {
    return <p>Log in to view your profile.</p>;
  }

  return (
    <section className="site-page">
      <p className="site-eyebrow">Your Profile</p>
      <h1>Profile</h1>
      <p>Signed in as {session.user.email}</p>

      <h2>Your interests</h2>

      {loading ? (
        <p role="status">Loading your interests…</p>
      ) : error || !data ? (
        <div>
          <p role="alert">
            {error ?? "Unable to load your interests."}
          </p>
          <button
            type="button"
            className="site-button"
            onClick={reload}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {data.preferences.length > 0 ? (
            <ul aria-label="Your interests and skill levels">
              {data.preferences.map((preference) => {
                const label =
                  HOBBIES.find(
                    (hobby) => hobby.id === preference.hobby
                  )?.label ?? preference.hobby;

                return (
                  <li key={preference.hobby}>
                    {label}: {preference.experience_level}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>You haven’t selected any interests yet.</p>
          )}

          <Link to="/onboarding" className="site-text-link">
            Edit hobbies and skill levels
          </Link>
        </>
      )}
    </section>
  );
}

export default ProfilePage;
