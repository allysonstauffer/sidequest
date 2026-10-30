import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoutButton from "./LogoutButton";
import NotificationBell from "../components/NotificationBell";
import UnreadMessagesBadge from "../messages/UnreadMessagesBadge";

const imgIcon =
  "https://www.figma.com/api/mcp/asset/59706023-6a8b-469b-bcf1-b9943e46edd3.svg";
const imgActiveMarker =
  "https://www.figma.com/api/mcp/asset/bb150a0e-c82a-43ef-aba3-d0cf68c53b30.svg";
const imgSearch =
  "https://www.figma.com/api/mcp/asset/c21f9e9e-c1b2-4c06-8b6f-390958250661.svg";
const imgIcon1 =
  "https://www.figma.com/api/mcp/asset/21122cb5-fda7-4477-9594-f4926496ce65.svg";
const imgTwoPeopleTalking =
  "https://www.figma.com/api/mcp/asset/0eadaef5-3212-49d7-a00d-2c01ea5fefe5.svg";
const imgSettings =
  "https://www.figma.com/api/mcp/asset/5991e596-afae-449d-934e-f0307f52abf6.svg";
const navItems = [
  { label: "Home", icon: imgIcon, to: "/feed" },
  { label: "Community", icon: imgSearch, to: "/community" },
  { label: "Search", icon: imgIcon1, to: "/search" },
  {
    label: "Messages",
    icon: imgTwoPeopleTalking,
    to: "/messages"
  },
  { label: "Settings", icon: imgSettings, to: "/settings" }
];
function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Link
            className="brand-logo"
            to="/feed"
            aria-label="Go to your feed">
            <img
              src="/branding/sidequest-wordmark-dark.png"
              alt="SideQuest"
            />
          </Link>

          <nav
            className="nav-list"
            aria-label="Primary navigation">
            <NotificationBell />
            {navItems.map(({ label, to }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  `nav-item ${to === "/messages" ? "messages-link" : ""} ${isActive ? "active" : ""}`
                }>
                <span>{label}</span>
                {to === "/messages" && <UnreadMessagesBadge />}
                {window.location.pathname === to && (
                  <img
                    src={imgActiveMarker}
                    alt=""
                    className="active-marker"
                  />
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <Link to="/share" className="cta-button">
            <span>Share a sidequest</span>
          </Link>

          <Link to="/profile" className="cta-button">
            <span>Profile</span>
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <div className="content-stage">{children}</div>
    </div>
  );
}

export default DashboardLayout;
