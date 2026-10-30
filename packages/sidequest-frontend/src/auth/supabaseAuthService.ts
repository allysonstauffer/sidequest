import type {
  AuthError,
  SupabaseClient
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { AuthService } from "./authService";
import { isUsernameAvailable } from "./usernameAvailability";

function errorMessage(error: AuthError): string {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "Please wait before requesting another email.";
    case "over_request_rate_limit":
      return "Too many attempts. Please wait and try again.";
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_already_confirmed":
      return "This email is already confirmed. Log in instead.";
    case "email_exists":
      return "An account with this email already exists. Log in instead.";
    case "user_already_exists":
      return "An account with this username already exists. Try another username"
    default:
      return error.status === 429
        ? "Too many attempts. Please wait and try again."
        : error.message;
  }
}

export function createSupabaseAuthService(
  client: Pick<SupabaseClient, "auth" | "rpc">,
  getConfirmationRedirect: () => string
): AuthService {
  return {
    isUsernameAvailable(username) {
      return isUsernameAvailable(client, username);
    },
    async signIn({ email, password }) {
      const submittedEmail = email.trim();
      try {
        const { data, error } =
          await client.auth.signInWithPassword({
            email: submittedEmail,
            password
          });
        if (error?.code === "email_not_confirmed") {
          return {
            status: "confirmation-required",
            email: submittedEmail
          };
        }
        if (error) {
          return {
            status: "error",
            message: errorMessage(error)
          };
        }
        if (data.session) return { status: "authenticated" };
        return {
          status: "error",
          message: "Unable to log in. Please try again."
        };
      } catch {
        return {
          status: "error",
          message: "Unable to log in. Please try again."
        };
      }
    },

    async signUp({ email, password, user }) {
      const submittedEmail = email.trim();
      const username = user.trim();
      try {
        if (!(await isUsernameAvailable(client, username))) {
          return { status: "username-exists" };
        }
        const { data, error } = await client.auth.signUp({
          email: submittedEmail,
          password,

          options: {
            emailRedirectTo: getConfirmationRedirect(),
            data: {
              display_name: username
            }
          }
        });
        if (
          error?.code === "user_already_exists" ||
          error?.code === "email_exists"
        ) {
          return { status: "account-exists" };
        }
        if (error) {
          if (!(await isUsernameAvailable(client, username))) {
            return { status: "username-exists" };
          }
          return {
            status: "error",
            message: errorMessage(error)
          };
        }
        if (data.session) return { status: "authenticated" };

        const user = data.user;
        if (!user) return { status: "unknown" };

        // Supabase's sanitizeUser currently hides confirmed
        // duplicates using an empty role AND empty identities.
        // Empty identities alone can also describe an invitation.
        // https://github.com/supabase/auth/blob/master/internal/api/signup.go
        // Keep unfamiliar/provider-changed responses neutral.
        if (
          user.role === "" &&
          Array.isArray(user.identities) &&
          user.identities.length === 0
        ) {
          return { status: "account-exists" };
        }

        if (!Array.isArray(user.identities)) {
          return { status: "unknown" };
        }

        const hasEmailIdentity = user.identities.some(
          (identity) => identity.provider === "email"
        );
        const hasPendingInvitation = Boolean(
          user.invited_at && user.role?.trim()
        );
        if (
          user.email?.trim() &&
          user.confirmation_sent_at &&
          !user.email_confirmed_at &&
          !user.confirmed_at &&
          (hasEmailIdentity || hasPendingInvitation)
        ) {
          return {
            status: "confirmation-required",
            email: submittedEmail
          };
        }
        return { status: "unknown" };
      } catch {
        return {
          status: "error",
          message: "Unable to sign up. Please try again."
        };
      }
    },

    async resendConfirmation(email) {
      try {
        const { error } = await client.auth.resend({
          type: "signup",
          email: email.trim(),
          options: {
            emailRedirectTo: getConfirmationRedirect()
          }
        });
        if (error) {
          return {
            status: "error",
            message: errorMessage(error)
          };
        }
        return { status: "sent" };
      } catch {
        return {
          status: "error",
          message:
            "Unable to send a confirmation link. Please try again."
        };
      }
    }
  };
}

export const supabaseAuthService = createSupabaseAuthService(
  supabase,
  () => `${window.location.origin}/login`
);
