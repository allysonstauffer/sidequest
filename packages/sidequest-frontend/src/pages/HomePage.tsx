import { Link } from "react-router-dom"
import DashboardLayout from "../components/DashboardLayout"
import Recommendations from "../components/Recommendations";
import ProjectFeed from "../components/ProjectFeed";
const imgIcon3 =
  "https://www.figma.com/api/mcp/asset/528c07f3-fe9a-438d-ab72-05773043bd94.svg";
const imgIcon4 =
  "https://www.figma.com/api/mcp/asset/f5d983c7-1d55-4601-9522-1669591869c0.svg";
function HomePage() {
  return (
    <DashboardLayout>
      <main className="feed">
        <header className="feed-header">
          <div className="greeting-wrap">
            <h1>Good Afternoon, user</h1>

            <p>See what your community is making.</p>
          </div>

          <div
            className="header-actions"
            aria-label="Header actions">
            <Link
              to="/share"
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

        <section className="discover-block">
          <div className="section-heading">
            <span>Explore your next side quest</span>
            <Link to="/browse" className="link-button">
              Browse all
            </Link>
          </div>

          <Recommendations />
        </section>

        <ProjectFeed />
      </main>
    </DashboardLayout>
  );
}
export default HomePage;