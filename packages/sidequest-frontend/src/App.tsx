//this is all figma to code btw i just removed all the demo pieces
//we should prob get actual images for stuff like the logo and icons cause these are pretty bad

import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate
} from "react-router-dom";
import type { ReactNode } from "react";
import { useRef, useState, type FormEvent } from "react";
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
import OnboardingPage from "./pages/OnboardingPage";
import RequireOnboarding from "./components/RequireOnboarding";
import Recommendations from "./components/Recommendations";
import ProjectFeed from "./components/ProjectFeed";
import { useAuth } from "./auth/useAuth";
import { compressImage } from "./components/compression";
import { publishProject } from "./lib/projectApi";
import { supabase } from "./lib/supabase";
import CollaborationsPage from "./pages/CollaborationsPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import NotificationBell from "./components/NotificationBell";

const imgActiveMarker =
  "https://www.figma.com/api/mcp/asset/bb150a0e-c82a-43ef-aba3-d0cf68c53b30.svg";
const imgIcon3 =
  "https://www.figma.com/api/mcp/asset/528c07f3-fe9a-438d-ab72-05773043bd94.svg";

const navItems = [
  { label: "Home", to: "/feed" },
  { label: "Community", to: "/community" },
  { label: "Search", to: "/search" },
  { label: "Messages", to: "/messages" },
  { label: "Collaborations", to: "/collaborations" },
  { label: "Settings", to: "/settings" }
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
            <Route
              path="onboarding"
              element={<OnboardingPage />}
            />
            <Route element={<RequireOnboarding />}>
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<RequireOnboarding />}>
            <Route path="/feed" element={<HomePage />} />
            <Route
              path="/notifications"
              element={
                <DashboardLayout>
                  <NotificationsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <DashboardLayout>
                  <ProjectDetailsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/collaborations"
              element={
                <DashboardLayout>
                  <CollaborationsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/community"
              element={<CommunityPage />}
            />
            <Route path="/search" element={<SearchPage />} />
            <Route
              path="/messages"
              element={<MessagesPage />}
            />
            <Route
              path="/settings"
              element={<SettingsPage />}
            />
            <Route path="/share" element={<SharePage />} />
            <Route path="/browse" element={<BrowsePage />} />
          </Route>
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
            <NotificationBell />
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

          <Link to="/profile" className="cta-button">
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
  const [isUploading, setIsUploading] = useState(false);
  const publishingRef = useRef(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  async function handlePublish(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (publishingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const file = formData.get("attachment");
    if (!(file instanceof File) || file.size === 0) {
      setNotice("Choose an image to share.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.type
      )
    ) {
      setNotice("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    const title = formData.get("title");
    if (typeof title !== "string" || !title.trim()) {
      setNotice("Enter a title for your side quest.");
      return;
    }
    formData.set("title", title.trim());
    if (!session) {
      setNotice("Sign in before posting.");
      return;
    }

    publishingRef.current = true;
    setIsUploading(true);
    setNotice("Preparing your image…");
    try {
      const compressed = await compressImage(file);
      if (compressed.size > 10 * 1024 * 1024) {
        throw new Error(
          "This image is still too large. Choose a smaller image."
        );
      }
      formData.set("attachment", compressed, compressed.name);

      // Compression can take time; refresh an expired session before sending.
      const { data, error } = await supabase.auth.getSession();
      if (
        error ||
        !data.session ||
        data.session.user.id !== session.user.id
      ) {
        throw new Error(
          "Your session changed. Please sign in again before posting."
        );
      }
      setNotice("Uploading your side quest…");
      await publishProject(formData, data.session.access_token);
      navigate("/feed");
    } catch (error) {
      setNotice(
        error instanceof TypeError
          ? "Could not reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Could not publish your post. Please try again."
      );
    } finally {
      setIsUploading(false);
      publishingRef.current = false;
    }
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
              maxLength={200}
              disabled={isUploading}
              required
            />
          </label>
          <label className="field-group">
            <span>Attachments</span>
            <input
              type="file"
              name="attachment"
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploading}
              required
            />

            <span>What are you making?</span>
            <textarea
              name="description"
              placeholder="Share what you are making"
              disabled={isUploading}
              required
            />
          </label>
          <label className="collaboration-option">
            <input
              type="checkbox"
              name="looking_for_collaborators"
              value="true"
              disabled={isUploading}
            />

            <span>I’m looking for help or collaborators</span>
          </label>
          <div className="submit-row">
            <button
              type="submit"
              className="primary-button"
              disabled={isUploading}>
              {isUploading ? "Publishing…" : "Publish"}
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
