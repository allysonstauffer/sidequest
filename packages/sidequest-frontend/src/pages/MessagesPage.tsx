import DashboardLayout from "../components/DashboardLayout"

function MessagesPage() {
  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Messages</p>
            <h2>Inbox</h2>
          </div>
        </div>

        <p className="empty-state">No messages yet.</p>
      </div>
    </DashboardLayout>
  );
}
export default MessagesPage;
