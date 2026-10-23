import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";
import InfoPage from "./pages/InfoPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SiteLayout from "./components/SiteLayout";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import MessagesPage from "./pages/MessagesPage";
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
              path="/community"
              element={<CommunityPage />}
            />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/share" element={<SharePage />} />
            <Route path="/browse" element={<BrowsePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
