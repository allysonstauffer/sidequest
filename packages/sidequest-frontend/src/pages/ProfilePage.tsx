import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { PreferenceService } from "../preferences/model";
import { supabasePreferenceService } from "../preferences/supabasePreferenceService";
import { usePreferences } from "../preferences/usePreferences";
import { useHobbyCategories } from "../hobbies/useHobbyCategories";
import ProjectFeed from "../components/ProjectFeed";
import SidequestEvents from "../components/SidequestEvents";
import CreatorProfile from "../components/CreatorProfile";
interface Props {
  preferenceService?: PreferenceService;
}

function ProfilePage({
  preferenceService = supabasePreferenceService
}: Props) {
  const { session, loading: authLoading } = useAuth();
  const { categories } = useHobbyCategories();
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
      <CreatorProfile userId={session.user.id} editable />

      <section aria-labelledby="profile-interests-heading">
        <h2 id="profile-interests-heading">Your interests</h2>
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
                    categories.find(
                      (hobby) => hobby.id === preference.hobby
                    )?.name ?? preference.hobby;

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

      <SidequestEvents
        viewerId={session.user.id}
        hostId={session.user.id}
        allowCreate
        title="My Upcoming Sidequests"
      />

      <section aria-labelledby="project-feed-title">
        <Link to="/share" className="site-text-link">
          Share a project
        </Link>
        <ProjectFeed
          authorId={session.user.id}
          accessToken={session.access_token}
          title="My Projects"
        />
      </section>
    </section>
  );
}

export default ProfilePage;
