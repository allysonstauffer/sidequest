import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Recommendations from "../components/Recommendations";
import ProjectFeed from "../components/ProjectFeed";
import SidequestEvents from "../components/SidequestEvents";
import { useAuth } from "../auth/useAuth";
const imgIcon3 =
  "https://www.figma.com/api/mcp/asset/528c07f3-fe9a-438d-ab72-05773043bd94.svg";
const imgIcon4 =
  "https://www.figma.com/api/mcp/asset/f5d983c7-1d55-4601-9522-1669591869c0.svg";
function getTimeOfDay(
  date: Date = new Date()
): "Morning" | "Afternoon" | "Evening" | "Night" {
  const hours = date.getHours();

  if (hours >= 5 && hours < 12) {
    return "Morning";
  } else if (hours >= 12 && hours < 17) {
    return "Afternoon";
  } else if (hours >= 17 && hours < 21) {
    return "Evening";
  } else {
    return "Night";
  }
}
function HomePage() {
  const { session } = useAuth();
  if (!session) {
    return <p role="status">Loading your feed…</p>;
  }
  return (
    <DashboardLayout>
      <main className="feed">
        <header className="feed-header">
          <div className="greeting-wrap">
            <h1>
              Good {getTimeOfDay()},{" "}
              {session.user.user_metadata.display_name ??
                "there"}
              !
            </h1>

            <p>See what your community is making.</p>
          </div>

          <div
            className="header-actions"
            aria-label="Header actions">
            <Link
              to="/profile"
              className="icon-button small-button"
              aria-label="Add">
              <img src={imgIcon3} alt="" />
            </Link>
            <Link
              to="/messages"
              className="icon-button small-button has-alert"
              aria-label="Notifications">
              <img src={imgIcon4} alt="" />
            </Link>
          </div>
        </header>

        {session ? (
          <SidequestEvents
            viewerId={session.user.id}
            title="Explore your next sidequest"
          />
        ) : null}

        <section className="discover-block">
          <div className="section-heading">
            <span>Suggested activities for you</span>
            <Link to="/browse" className="link-button">
              Browse all
            </Link>
          </div>

          <Recommendations />
        </section>

        {session ? (
          <ProjectFeed
            followedById={session.user.id}
            title="Projects from people you follow"
          />
        ) : null}
      </main>
    </DashboardLayout>
  );
}
export default HomePage;
