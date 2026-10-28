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

From the repository root, start the app or run lint and build:

```sh
npm run dev --workspace=sidequest-frontend
npm run lint --workspace=sidequest-frontend
npm run build --workspace=sidequest-frontend
```

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

Message persistence remains a placeholder. Public communities,
profiles, and hobby preferences use the database setup described
below. The frontend route guards control navigation; database
permissions and Row Level Security enforce record access.

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

### Hobby and skill onboarding

After authentication, `RequireOnboarding` checks the signed-in
user's profile and saved hobbies. Users without a completion
timestamp and at least one saved hobby go to `/onboarding`. That
page requires authentication but is outside the completion
guard, so users can finish onboarding or edit their choices.
Password recovery stays outside the completion guard.

The initial catalogue is Photography, Gardening, and Cooking.
Each selection has its own level: Beginner, Intermediate,
Advanced, or Expert. These values live in
`src/preferences/model.ts` and must agree with the database
constraints and save function. Unsupported or duplicate saved
values produce an error rather than being silently removed.

`InterestSkillPicker` displays choices. `usePreferenceDraft`
owns selection, validation, and saving; `usePreferences` loads
data and supports retry while ignoring stale responses. Both
hooks depend on the small `PreferenceService` interface. The
Supabase adapter performs reads and the RPC. `AuthProvider`
continues to manage only the authentication session.

Saving requires these existing database tables:

- `public.profiles`: `id` (Auth user UUID), nullable profile
  fields, and `onboarding_completed_at` (`timestamptz`).
- `public.user_hobbies`: generated `id`, `user_id` referencing
  `profiles.id`, `hobby`, and `experience_level`.

Apply the repository migration
[`202610150001_save_my_preferences.sql`](../../supabase/migrations/202610150001_save_my_preferences.sql)
through your normal Supabase migration workflow or SQL Editor if
the API cannot find `save_my_preferences(p_preferences)`. The
function validates choices, derives the owner from `auth.uid()`,
creates a missing profile without overwriting existing fields,
locks that profile, replaces hobby rows, and sets the completion
timestamp in one transaction. A failure rolls back the
replacement. Execution is limited to the authenticated role and
respects existing RLS policies.

The migration assumes owner-write policies are already enabled
for both tables. It preserves the team's public-read policies;
preferences are not promised to be private. It also grants usage
on the generated ID sequence when one exists. The skill
constraint must permit all four exact, capitalized values. Keep
the existing unique `(user_id, hobby)` constraint and foreign
keys in place.

The profile page displays saved interests and links back to the
editor. The feed ranks 12 bundled starter activities by matching
hobbies and difficulty at or below the user's level, with the
nearest difficulty first. This catalogue covers all three
hobbies and four levels. It is separate from shared project
records; real project recommendations require a hobby/difficulty
association in that schema.

### Projects and sidequest events

Projects are completed work stored in `public.projects`.
Sidequests are upcoming public events stored separately in
`public.sidequests`; users can RSVP through
`public.sidequest_rsvps`. The profile shows the user's projects
and upcoming hosted events. `/feed` lists public upcoming events
with title/description search and hobby and recommended-skill
filters, separate suggested activities, and completed projects
from authors the current user follows.

Apply
[`202610280003_sidequest_events.sql`](../../supabase/migrations/202610280003_sidequest_events.sql)
to create the event and RSVP tables and their row-level security
policies. Existing project rows are not changed. The previous
beginner-friendly project field remains in the database for
compatibility, but completed project cards and the project form
no longer show or use beginner/experience labels.

Apply
[`202610280004_user_follows.sql`](../../supabase/migrations/202610280004_user_follows.sql)
to enable one-way follows. Users can follow other accounts from
their public profile, and `/feed` then shows projects by those
authors.

Apply
[`202610280005_communities.sql`](../../supabase/migrations/202610280005_communities.sql)
to enable the community directory. Signed-in users can create
public communities in the supported hobby categories. Creating a
community does not add a separate membership or join
relationship.
