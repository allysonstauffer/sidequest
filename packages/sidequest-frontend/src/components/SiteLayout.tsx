import {
  Link,
  NavLink,
  Outlet,
  useLocation
} from "react-router-dom";
import {
  House,
  LogIn,
  MessageCircle,
  Search,
  Settings,
  UsersRound
} from "lucide-react";
import "./SiteLayout.css";
import { useAuth } from "../auth/useAuth";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";

function SiteLayout() {
  const { session, loading } = useAuth();
  const isLandingPage = useLocation().pathname === "/";

  if (!isLandingPage) {
    return (
      <div className="site-shell">
        <header className="site-header">
          <Link to="/" className="site-brand">
            SideQuest
          </Link>
          <nav
            className="site-nav"
            aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/feed">Feed</NavLink>
            <NavLink to="/info">Info</NavLink>
            <NavLink to="/profile">Profile</NavLink>
            {session && <NotificationBell />}
            {session && (
              <NavLink to="/collaborations">
                Collaborations
              </NavLink>
            )}
            {!loading &&
              (session ? (
                <LogoutButton />
              ) : (
                <NavLink to="/login" className="site-nav-login">
                  Log in
                </NavLink>
              ))}
          </nav>
        </header>

        <main className="site-content">
          <Outlet />
        </main>

        <footer className="site-footer">SideQuest</footer>
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <aside
        className="desktop-sidebar"
        aria-label="SideQuest sidebar">
        <Link
          className="sidebar-wordmark"
          to="/"
          aria-label="SideQuest home">
          <span className="sidebar-mark" aria-hidden="true">
            s
          </span>
          <span>sidequest</span>
        </Link>
        <p className="sidebar-caption">YOUR SPACE</p>

        <nav
          className="sidebar-navigation"
          aria-label="Primary navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `sidebar-item${isActive ? " is-active" : ""}`
            }>
            <House aria-hidden="true" />
            <span>Home</span>
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) =>
              `sidebar-item${isActive ? " is-active" : ""}`
            }>
            <UsersRound aria-hidden="true" />
            <span>Community</span>
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `sidebar-item${isActive ? " is-active" : ""}`
            }>
            <Search aria-hidden="true" />
            <span>Search</span>
          </NavLink>
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `sidebar-item${isActive ? " is-active" : ""}`
            }>
            <MessageCircle aria-hidden="true" />
            <span>Messages</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-item${isActive ? " is-active" : ""}`
            }>
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
        </nav>

        {!loading &&
          (session ? (
            <LogoutButton />
          ) : (
            <Link to="/login" className="login-button">
              <LogIn aria-hidden="true" />
              <span>Log In</span>
            </Link>
          ))}
      </aside>

      <main className="page-content">
        <Outlet />
      </main>

      <nav
        className="mobile-navigation"
        aria-label="Primary navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " is-active" : ""}`
          }>
          <House aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/community"
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " is-active" : ""}`
          }>
          <UsersRound aria-hidden="true" />
          <span>Community</span>
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " is-active" : ""}`
          }>
          <Search aria-hidden="true" />
          <span>Search</span>
        </NavLink>
        <NavLink
          to="/messages"
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " is-active" : ""}`
          }>
          <MessageCircle aria-hidden="true" />
          <span>Messages</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " is-active" : ""}`
          }>
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default SiteLayout;
