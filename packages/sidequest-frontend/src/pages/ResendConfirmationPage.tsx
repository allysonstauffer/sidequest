import { Navigate } from "react-router-dom";

// Older links return to the contextual confirmation flow on the login page.
export default function ResendConfirmationPage() {
  return <Navigate to="/login" replace />;
}
