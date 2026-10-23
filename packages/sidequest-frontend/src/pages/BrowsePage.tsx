import DashboardLayout from "../components/DashboardLayout"

function BrowsePage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Explore</p>
            <h2>Discover next ideas</h2>
          </div>
        </div>

        <p className="empty-state">
          There are no ideas to discover yet.
        </p>
      </div>
    </DashboardLayout>
  );
}
export default BrowsePage;