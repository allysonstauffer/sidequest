//this is all figma to code btw i just removed all the demo pieces
//we should prob get actual images for stuff like the logo and icons cause these are pretty bad

import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes
} from "react-router-dom";
import type { ReactNode } from "react";
import { useState, type FormEvent } from "react";
import InfoPage from "./pages/InfoPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SiteLayout from "./components/SiteLayout";
import "./App.css";
import RequireAuth from "./components/RequireAuth";
import LogoutButton from "./components/LogoutButton";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ResendConfirmationPage from "./pages/ResendConfirmationPage";

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
const imgIcon3 =
  "https://www.figma.com/api/mcp/asset/528c07f3-fe9a-438d-ab72-05773043bd94.svg";
const imgIcon4 =
  "https://www.figma.com/api/mcp/asset/f5d983c7-1d55-4601-9522-1669591869c0.svg";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="info" element={<InfoPage />} />
          <Route
            path="resend-confirmation"
            element={<ResendConfirmationPage />}
          />
          <Route
            path="forgot-password"
            element={<ForgotPasswordPage />}
          />
          <Route
            path="reset-password"
            element={<ResetPasswordPage />}
          />
          <Route element={<RequireAuth />}>
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/feed" element={<HomePage />} />
          <Route
            path="/community"
            element={<CommunityPage />}
          />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/browse" element={<BrowsePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-row">
            <div
              className="brand-mark"
              aria-label="SideQuest logo">
              <div className="brand-graphic"></div>
            </div>
            <div className="brand-name">SideQuest</div>
          </div>

          <nav
            className="nav-list"
            aria-label="Primary navigation">
            {navItems.map(({ label, to }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }>
                <span>{label}</span>
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
            <span>Share a side quest</span>
          </Link>
          
          <Link to ="/profile" className="cta-button">
            <span> Profile</span>
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <div className="content-stage">{children}</div>
    </div>
  );
}

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

          <p className="empty-state">
            No recommendations are available yet.
          </p>
        </section>

        <p className="empty-state">
          No projects have been shared yet.
        </p>
      </main>
    </DashboardLayout>
  );
}

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

function SearchPage() {
  const [notice, setNotice] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("barebones, no search yet.");
  }

  return (
    <DashboardLayout>
      <div className="page-shell">
        <form className="form-card" onSubmit={handleSearch}>
          <label className="field-group">
            <span>Search projects, makers, and hobbies</span>
            <input name="query" type="search" />
          </label>
          <div className="submit-row">
            <button type="submit" className="primary-button">
              Search
            </button>
          </div>
          {notice && (
            <p className="empty-state" role="status">
              {notice}
            </p>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
}

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

function SharePage() {
  const [notice, setNotice] = useState("");

  function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Project publishing is not available yet.");
  }

  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Create</p>
            <h2>Share a side quest</h2>
          </div>
        </div>

        <form className="form-card" onSubmit={handlePublish}>
          <label className="field-group">
            <span>Title</span>
            <input
              name="title"
              placeholder="Give your side quest a title"
              required
            />
          </label>
          <label className="field-group">
            <span>Attachments</span>
            <input type="file"></input>
            <span>What are you making?</span>
            <textarea
              name="description"
              placeholder="Share what you are making"
              required
            />
          </label>
          <div className="submit-row">
            <button type="submit" className="primary-button">
              Publish
            </button>
          </div>
          {notice && (
            <p className="empty-state" role="status">
              {notice}
            </p>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
}

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

export default App;
