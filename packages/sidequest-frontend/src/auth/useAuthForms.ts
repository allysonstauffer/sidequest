import { useRef, useState } from "react";
import type {
  AuthCredentials_SignIn,
  AuthCredentials_SignUp,
  AuthService
} from "./authService";
import { getAuthLinkError } from "./authLinkError";

type AuthAction = "signin" | "signup" | "resend";
type Confirmation = {
  email: string;
  source: "signin" | "signup";
  requested: boolean;
};

export function useAuthForms(service: AuthService) {
  const [pendingAction, setPendingAction] =
    useState<AuthAction | null>(null);
  const requestInFlight = useRef(false);
  const [loginNotice, setLoginNotice] =
    useState(getAuthLinkError);
  const [signupNotice, setSignupNotice] = useState("");
  const [confirmation, setConfirmation] =
    useState<Confirmation | null>(null);
  const [resendNotice, setResendNotice] = useState("");

  // Also prevent a second request before React renders disabled fields.
  async function runAction(
    action: AuthAction,
    request: () => Promise<void>
  ) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setPendingAction(action);
    try {
      await request();
    } finally {
      requestInFlight.current = false;
      setPendingAction(null);
    }
  }

  function clearConfirmation() {
    setConfirmation(null);
    setResendNotice("");
  }

  function changeEmail(source: Confirmation["source"]) {
    if (source === "signin") setLoginNotice("");
    else setSignupNotice("");
    if (confirmation?.source === source) clearConfirmation();
  }

  async function signIn(credentials: AuthCredentials_SignIn) {
    await runAction("signin", async () => {
      setLoginNotice("");
      setSignupNotice("");
      clearConfirmation();
      try {
        const result = await service.signIn(credentials);
        if (result.status === "error") {
          setLoginNotice(result.message);
        } else if (result.status === "confirmation-required") {
          setLoginNotice(
            "Confirm your email before logging in."
          );
          setConfirmation({
            email: result.email,
            source: "signin",
            requested: false
          });
        }
        // AuthProvider observes a successful session and the page redirects.
      } catch {
        setLoginNotice("Unable to log in. Please try again.");
      }
    });
  }

  async function signUp(
    credentials: AuthCredentials_SignUp & { confirmPassword: string }
  ) {
    if (requestInFlight.current) return;
    setSignupNotice("");
    setLoginNotice("");
    clearConfirmation();
    const username = credentials.user.trim();
    if (!username || username.length > 40) {
      setSignupNotice("Username must be between 1 and 40 characters.");
      return;
    }
    if (credentials.password !== credentials.confirmPassword) {
      setSignupNotice("Passwords do not match.");
      return;
    }

    await runAction("signup", async () => {
      try {
        const result = await service.signUp({
          user: username,
          email: credentials.email,
          password: credentials.password
        });
        switch (result.status) {
          case "account-exists":
            setSignupNotice(
              "An account with this email already exists. Log in instead."
            );
            break;
          case "username-exists":
            setSignupNotice(
              "An account with this username already exists. Try another username."
            );
            break;
          case "confirmation-required":
            setSignupNotice(
              "Check your email for a confirmation link."
            );
            setConfirmation({
              email: result.email,
              source: "signup",
              requested: true
            });
            break;
          case "error":
            setSignupNotice(result.message);
            break;
          case "unknown":
            setSignupNotice(
              "We couldn't confirm your signup status. If you already have an account, log in. Otherwise, please try again."
            );
            break;
          case "authenticated":
            break;
        }
      } catch {
        setSignupNotice("Unable to sign up. Please try again.");
      }
    });
  }

  async function resendConfirmation() {
    if (!confirmation) return;
    const email = confirmation.email;
    await runAction("resend", async () => {
      setResendNotice("");
      try {
        const result = await service.resendConfirmation(email);
        if (result.status === "sent") {
          setConfirmation({ ...confirmation, requested: true });
        }
        setResendNotice(
          result.status === "sent"
            ? "Confirmation email requested. Check your inbox and spam folder."
            : result.message
        );
      } catch {
        setResendNotice(
          "Unable to send a confirmation link. Please try again."
        );
      }
    });
  }

  return {
    pendingAction,
    loginNotice,
    signupNotice,
    confirmation,
    resendNotice,
    signIn,
    signUp,
    resendConfirmation,
    changeEmail
  };
}
