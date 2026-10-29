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

Shared projects use the Python upload API and Supabase.
Community and message persistence remain placeholders. Profiles
and hobby preferences use the database setup described below.
The frontend route guards control navigation; database
permissions and Row Level Security enforce record access.

### Posting side quests

Start both processes from the repository root. The frontend dev
server proxies `/api` to the Python API on port 8000.

```sh
# Backend: activate the project's Python environment first.
python -m pip install -r packages/sidequest-backend/requirements.txt
npm run dev

# Frontend: run in another terminal.
npm run dev --workspace=sidequest-frontend
```

Set these in `packages/sidequest-backend/.env`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-publishable-or-anon-key
SUPABASE_STORAGE_BUCKET=project-media
```

Use the same Supabase project as the frontend. The old backend
`SUPABASE_SECRET_KEY` variable remains a fallback if
`SUPABASE_KEY` is unset. The API validates the user's access
token and attaches it to every database and storage request,
including cleanup and deletion. Requests use that user's
database/storage permissions, even when the configured API key
is privileged.

The existing `projects` table must support `id`, `author_id`,
`title`, `description`, `media_urls` (an array), and
`created_at`. Keep its existing visibility rules. Authenticated
owners need insert/select/delete access to their records.
Storage policies must allow owners to upload and remove files
under `images/<user-id>/` in the configured bucket; policies
should check the user-id folder (the second folder segment). The
current image display uses public URLs, so the configured bucket
must support public reads. These tables, bucket, and policies
must be provisioned in Supabase; this repository does not
currently include their original setup migration.

If the backend logs show PostgreSQL error `42501` while saving a
project, apply
[`202610190001_project_owner_permissions.sql`](../../supabase/migrations/202610190001_project_owner_permissions.sql)
in the Supabase SQL Editor or through your migration workflow.
It grants authenticated users insert, select, and delete access
for their own projects and preserves existing read policies. It
requires RLS to already be enabled and stops before making
changes if it is disabled. Existing restrictive policies still
apply. If the error code is different, inspect the backend's
`Project save failed` log before changing permissions; schema
constraints and connection failures need different fixes.

The sharing form compresses supported JPEG, PNG, and WebP files
before upload. The API independently validates and re-encodes
the image, uploads it, and saves the project record. A database
save failure attempts to remove the uploaded image. The frontend
only navigates to the feed when the API returns a saved project
ID. Profiles also display the user's posts and deletion
controls.

For production, route `/api/*` to FastAPI before applying the
SPA HTML fallback. If the API is hosted at a separate origin,
set `VITE_API_BASE_URL=https://your-api.example` in the
frontend's build environment and
`SIDEQUEST_FRONTEND_ORIGINS=https://your-frontend.example` in
the backend environment. The base URL must omit `/api`; the
client adds it. Multiple allowed frontend origins can be
comma-separated. Restart the backend and rebuild the frontend
after configuration changes. Same-origin hosting needs neither
setting.

Run the posting regression checks without creating real posts:

```sh
packages/sidequest-backend/.venv/bin/python -m unittest discover -s packages/sidequest-backend -p 'test_*.py'
npm test --workspace=sidequest-frontend
```

Run the frontend tests with Node 24, which provides built-in
TypeScript support. Backend tests use an isolated HTTP transport
with synthetic users and keys.

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

The picker searches the 450 hobbies in
`src/data/SideQuestHobbies.json` by name and keyword. Matching
ignores case, accents, and punctuation; name matches rank ahead
of keyword matches. The catalogue is bundled with the frontend,
so searching needs no network request. Results appear 20 at a
time with a Show more button.

Users can select one to three hobbies. Selected interests stay
visible across searches and each has its own level: Beginner,
Intermediate, Advanced, or Expert. Adding starts at Beginner;
users can change the level or remove a selection before saving.
The existing Photography, Gardening, and Cooking IDs remain
valid. Unsupported or duplicate saved values produce an error
rather than being silently removed.

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
constraint must permit all four exact, capitalized values. The
save function rejects duplicate hobby IDs and locks the profile
while replacing its preferences. Existing constraints and
foreign keys remain in place.

The profile page displays saved interests and links back to the
editor. The feed ranks 12 bundled starter activities by matching
hobbies and difficulty at or below the user's level, with the
nearest difficulty first. This catalogue covers all three
hobbies and four levels. It is separate from shared project
records; real project recommendations require a hobby/difficulty
association in that schema.

### Searchable hobby catalogue migration

After the preference migration above, apply
[`202610290001_searchable_hobby_catalogue.sql`](../../supabase/migrations/202610290001_searchable_hobby_catalogue.sql)
before using the expanded picker. It adds a `keywords` array to
the existing `public.hobby_categories` table and seeds the
supplied JSON into its `id`, `name`, and `keywords` columns.
Existing IDs keep their names, creators, creation timestamps,
and additional keywords. Custom categories are retained. All 450
supplied IDs satisfy the table's slug and length constraints.

The migration updates `save_my_preferences` to validate against
`hobby_categories`. The one-to-three limit and all four skill
levels remain enforced in both the frontend and save function.
The existing foreign keys from `user_hobbies`, `projects`,
`communities`, and `sidequests` remain unchanged. No separate
`hobbies` table is created.

Existing grants and RLS policies are preserved. The schema
export does not include them: authenticated users must already
be able to read the catalogue rows and read/write their own
profile and preferences for the save function to work. Review
those policies separately if saving fails. The migration runs as
one transaction.

After applying it, verify a known new entry with
`select id, name, keywords from public.hobby_categories where id = '3d-printing';`
and test saving a new hobby from onboarding. The total category
count can exceed 450 if the database has additional categories.

Future additions require updating the JSON and adding a new
catalogue seed migration before releasing the matching frontend.
Keep existing IDs stable. The regression tests check that this
initial migration's seed matches the JSON. Recommendations still
cover only Photography, Gardening, and Cooking; other hobbies
show an explanation when no suggestions are available.
