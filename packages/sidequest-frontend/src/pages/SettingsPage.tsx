import DashboardLayout from "../components/DashboardLayout"

function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Profile preferences</h2>
          </div>
        </div>

        <p className="empty-state">
          More profile preferences are coming soon.
        </p>
      </div>
    </DashboardLayout>
  );
}
export default SettingsPage;