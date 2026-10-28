export interface AuthCredentials_SignIn {
  email: string;
  password: string;
}
export interface AuthCredentials_SignUp {
  email: string;
  password: string;
  user: string;
}
export type SignInResult =
  | { status: "authenticated" }
  | { status: "confirmation-required"; email: string }
  | { status: "error"; message: string };

export type SignUpResult =
  | { status: "authenticated" }
  | { status: "confirmation-required"; email: string }
  | { status: "account-exists" }
  | { status: "username-exists"}
  | { status: "unknown" }
  | { status: "error"; message: string };

export type ResendResult =
  { status: "sent" } | { status: "error"; message: string };

export interface AuthService {
  signIn(credentials: AuthCredentials_SignIn): Promise<SignInResult>;
  signUp(credentials: AuthCredentials_SignUp): Promise<SignUpResult>;
  isUsernameAvailable(username: string): Promise<boolean>;
  resendConfirmation(email: string): Promise<ResendResult>;
}
