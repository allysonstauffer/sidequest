import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { HOBBIES } from "../preferences/model";
import type { PreferenceService } from "../preferences/model";
import {
  DEFAULT_ACTIVITIES,
  recommendActivities
} from "../preferences/recommendActivities";
import type { Activity } from "../preferences/recommendActivities";
import { supabasePreferenceService } from "../preferences/supabasePreferenceService";
import { usePreferences } from "../preferences/usePreferences";
import "./Recommendations.css";

interface Props {
  preferenceService?: PreferenceService;
  activities?: readonly Activity[];
}

export default function Recommendations({
  preferenceService = supabasePreferenceService,
  activities = DEFAULT_ACTIVITIES
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
    return <p>Log in to see activities for your interests.</p>;
  }

  if (loading) {
    return <p role="status">Finding activities for you…</p>;
  }

  if (error || !data) {
    return (
      <div className="recommendations-notice">
        <p role="alert">
          {error ?? "Unable to load your recommendations."}
        </p>
        <button
          type="button"
          className="link-button"
          onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const recommendations = recommendActivities(
    activities,
    data.preferences
  );

  if (recommendations.length === 0) {
    return (
      <div className="recommendations-notice">
        <p>
          No activity suggestions for your hobbies yet. Your
          interests are saved; you can still share projects and
          explore the latest posts.
        </p>
        <Link to="/onboarding" className="link-button">
          Update your interests
        </Link>
      </div>
    );
  }

  return (
    <ul
      className="recommendations-list"
      aria-label="Activities for your interests">
      {recommendations.map((activity) => {
        const hobbyLabel =
          HOBBIES.find((hobby) => hobby.id === activity.hobby)
            ?.label ?? activity.hobby;

        return (
          <li key={activity.id} className="recommendation-card">
            <p className="recommendation-details">
              {hobbyLabel} · {activity.difficulty}
            </p>
            <h2>{activity.title}</h2>
            <p>{activity.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
