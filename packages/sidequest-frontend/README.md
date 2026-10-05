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

Set these in `packages/sidequest-frontend/.env` (see
`.env.example`):

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
