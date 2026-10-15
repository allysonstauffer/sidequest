export interface AuthCredentials {
  email: string;
  password: string;
}

export type SignInResult =
  | { status: "authenticated" }
  | { status: "confirmation-required"; email: string }
  | { status: "error"; message: string };

export type SignUpResult =
  | { status: "authenticated" }
  | { status: "confirmation-required"; email: string }
  | { status: "account-exists" }
  | { status: "unknown" }
  | { status: "error"; message: string };

export type ResendResult =
  { status: "sent" } | { status: "error"; message: string };

export interface AuthService {
  signIn(credentials: AuthCredentials): Promise<SignInResult>;
  signUp(credentials: AuthCredentials): Promise<SignUpResult>;
  resendConfirmation(email: string): Promise<ResendResult>;
}
