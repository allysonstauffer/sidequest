import { Link } from "react-router-dom"
import DashboardLayout from "../components/DashboardLayout"
function CommunityPage() {
  return (
    <DashboardLayout>
      <div className="page-shell page-shell--compact">
        <div className="page-header">
          <div>
            <p className="eyebrow">Community</p>
            <h2>Creative circles</h2>
          </div>
          <Link to="/browse" className="primary-link">
            Browse more
          </Link>
        </div>

        <div className="page-grid">
          <p className="empty-state">
            No communities are available yet.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
export default CommunityPage;