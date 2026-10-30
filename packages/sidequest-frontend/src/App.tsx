//this is all figma to code btw i just removed all the demo pieces
//we should prob get actual images for stuff like the logo and icons cause these are pretty bad


import { BrowserRouter, Route, Routes } from "react-router-dom";
import InfoPage from "./pages/InfoPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import SiteLayout from "./components/SiteLayout";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import SearchPage from "./pages/SearchPage";
import SharePage from "./pages/SharePage";
import BrowsePage from "./pages/BrowsePage";
import CommunityPage from "./pages/CommunityPage";
import "./App.css";
import RequireAuth from "./components/RequireAuth";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ResendConfirmationPage from "./pages/ResendConfirmationPage";
import OnboardingPage from "./pages/OnboardingPage";
import RequireOnboarding from "./components/RequireOnboarding";
import CollaborationsPage from "./pages/CollaborationsPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import DashboardLayout from "./components/DashboardLayout";
import DM from "./pages/DM";

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
              <Route
                path="profile/:userId"
                element={<UserProfilePage />}
              />
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
            <Route path="/messages" element={<DM />} />
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
export default App;
