import { Link, NavLink, Outlet } from "react-router-dom";
import "./SiteLayout.css";
import { useAuth } from "../auth/useAuth";
import LogoutButton from "./LogoutButton";

function SiteLayout() {
  const { session, loading } = useAuth();
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link to="/" className="site-brand">
          SideQuest
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/feed">Feed</NavLink>
          <NavLink to="/info">Info</NavLink>
          <NavLink to="/profile">Profile</NavLink>
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

export default SiteLayout;
