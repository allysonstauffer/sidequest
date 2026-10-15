# React + TypeScript + Vite

This template provides a minimal setup to get React working in
Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react)
  uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc)
  uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of
its impact on dev & build performances. To add it, see
[this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend
updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: [
          "./tsconfig.node.json",
          "./tsconfig.app.json"
        ],
        tsconfigRootDir: import.meta.dirname
      }
      // other options...
    }
  }
]);
```

You can also install
[eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x)
and
[eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom)
for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended
    ],
    languageOptions: {
      parserOptions: {
        project: [
          "./tsconfig.node.json",
          "./tsconfig.app.json"
        ],
        tsconfigRootDir: import.meta.dirname
      }
      // other options...
    }
  }
]);
```

## SideQuest authentication

The frontend supports email/password signup and login, signup
confirmation, confirmation resend, logout, and password
recovery. Supabase manages users and passwords; no custom
password table is needed.

### Local configuration

Set these in `packages/sidequest-frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Use a frontend publishable or legacy anon key. Never use a
secret/service-role key. Restart Vite after environment changes.

In your Supabase dashboard:

1. Enable email/password auth and signup under Authentication →
   Providers.
2. Enable email confirmation.
3. Under Authentication → URL Configuration, set the Site URL to
   `http://localhost:5173` and add both redirect URLs:
   - `http://localhost:5173/login`
   - `http://localhost:5173/reset-password`

   #TODO

4. Configure custom SMTP to send confirmation and recovery
   emails outside your project team. The default Supabase mail
   service limits recipients and volume.
5. Retain the default email templates' ConfirmationURL links for
   this browser flow. If you have customized templates, verify
   they honor the redirect URL.

Match the URLs to your actual Vite port. Add production
equivalents when hosting. Your host must serve index.html for
frontend paths, including /login and /reset-password, so email
links work on a fresh browser visit.

Sources:
[password auth](https://supabase.com/docs/guides/auth/passwords),
[redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Verification

From the repository root:

```sh
npm run test:auth --workspace=sidequest-frontend
npm run lint --workspace=sidequest-frontend
npm run build --workspace=sidequest-frontend
npm run dev --workspace=sidequest-frontend
```

`test:auth` runs the real components' form handlers and route
declarations with mocked React hooks and Supabase responses. It
makes no network requests and creates no accounts. It does not
replace browser or live email testing.

Manually verify with your project:

1. Visit /feed and /profile while logged out; both redirect to
   /login.
2. Sign up with mismatched passwords; verify the error.
3. Sign up with a new address, confirm its email, and reach
   /feed.
4. Log out, try an incorrect password, then log in correctly.
5. Refresh a protected page; the session should persist.
6. Request a confirmation resend and verify its link.
7. Request a password reset, follow its link, save a new
   password, log out, and verify the new password works and the
   old one fails.
8. Try an expired email link; it should offer a new link rather
   than fail silently.

Database features remain placeholders. Before adding private
profile, project, or message tables, enforce access with
Supabase Row Level Security policies. The frontend route guard
alone does not restrict database access.

### Login and signup workflow

`LoginPage` renders the forms and passes an `AuthService` to
`useAuthForms`. The hook owns validation, notices, the active
request, and the email awaiting confirmation. The Supabase
adapter in `src/auth/supabaseAuthService.ts` translates SDK
responses into application outcomes. `AuthProvider` continues to
manage the session and successful authentication redirects to
`/feed`.

Only the active action shows a loading label. Both forms are
disabled while a request is pending, and a request lock also
prevents submissions before the disabled state has rendered.

Existing confirmed accounts display an explicit message when
Supabase returns a duplicate error or its current sanitized
duplicate response (an explicitly empty identity list and an
empty role). That response shape is an implementation detail of
[Supabase Auth's signup endpoint](https://github.com/supabase/auth/blob/master/internal/api/signup.go),
so the adapter keeps unfamiliar responses neutral rather than
claiming an account exists or an email was sent. Invited users
with a real role are handled separately. Verify these outcomes
against your project's auth configuration after provider
updates.

Resend appears inline after a signup response establishes
pending confirmation and a confirmation request. An unconfirmed
login alone does not establish that email was sent, so it first
offers "Send confirmation email"; only an accepted request
changes that action to "Resend confirmation email". The action
uses the submitted email, clears when that form's email changes,
and reports its own loading and errors. A successful request
means the provider accepted the request, not that the email
reached the inbox. Confirmation state lasts for the current page
visit; after a refresh, logging in with an unconfirmed account
offers the initial send action again. Older
`/resend-confirmation` links return to `/login`.

Repeated signup for an existing unconfirmed account can request
another confirmation email; it does not replace that account's
original password. The existing-account message deliberately
reveals account existence as part of this UX. No public user
lookup or privileged browser credential is used.
