# SideQuest

SideQuest is a social platform for hobbies and personal
projects. It helps people share what they are making, discover
interest-based communities and events, and meet others who enjoy
the same things.

The idea behind the product is simple: not every meaningful
social connection starts with work or a polished achievement.
SideQuest is for the things people do because they are curious,
creative, or having fun.

## Who it is for

SideQuest is intended for hobbyists at every experience level:

- People just getting started who want ideas, encouragement, or
  a community to learn with.
- Makers and creatives who want to share projects and works in
  progress.
- People looking for others to practice, collaborate, or spend
  time with around a shared interest.
- Community members and event hosts who want to bring people
  together around a hobby.

This describes the intended audience, not a claim about the size
or activity of a production user base.

## What the product does

- **Share projects:** Publish image-based hobby projects, edit
  or delete your own posts, and browse recent work.
- **Build a hobby profile:** Choose interests and experience
  levels during onboarding, then display them on your profile.
- **Find people:** Browse member profiles and follow people
  whose projects you want in your feed.
- **Discover communities:** Find communities by hobby, create
  communities, and join or leave them. Signed-in users can add
  hobby categories.
- **Meet up:** Browse upcoming SideQuest events, filter them by
  interest or skill level, host events, and RSVP.
- **Explore ideas:** See starter activities matched to selected
  hobbies and experience levels.
- **Manage an account:** Sign up and log in with email, confirm
  an address, recover a password, and update profile settings.
- **Message members:** A direct-message interface is present;
  see [Current limitations](#current-limitations) for its
  database prerequisites.

The app is evolving. The list above describes functionality
represented in the current code, not a promise that every screen
is production-ready or configured in every environment.

## Why SideQuest matters

Hobbies are a way to learn, make things, and connect outside of
work or school. SideQuest is designed to make those interests
easier to share and easier to discover: a person can post a
project, find a community, follow other makers, or join an event
centered on something they already enjoy. The focus is shared
interest and participation, rather than professional networking.

## Technology

| Area                    | Technologies                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| Frontend                | React 19, TypeScript, Vite 8, React Router                        |
| UI and assets           | CSS, Lucide React, browser-image-compression                      |
| Backend API             | Python, FastAPI, Uvicorn                                          |
| Image processing        | Pillow, python-multipart                                          |
| Data and authentication | Supabase Auth, PostgreSQL, Supabase JavaScript and Python clients |
| Developer tooling       | npm workspaces, TypeScript, ESLint, Prettier                      |

## How it fits together

This repository is an npm-workspace monorepo with a React
single-page app and a small FastAPI service:

1. The frontend uses Supabase directly for authentication and
   most database-backed product features.
2. The FastAPI service handles project image uploads and
   owner-authorized project edits and deletions. The Vite
   development server proxies `/api` requests to
   `http://127.0.0.1:8000`.
3. Supabase provides the hosted database, authentication, and
   object storage. Database access depends on the schema and Row
   Level Security (RLS) policies configured in the Supabase
   project.
4. SQL changes that are tracked by this repository live in
   `supabase/migrations/`.

For uploads, the backend validates JPEG, PNG, or WebP input,
limits the source to 10 MB and 25 megapixels, corrects image
orientation, and stores a resized JPEG in Supabase Storage. The
default bucket name is `project-media`.

## Repository map

| Path                           | Contents                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| `packages/sidequest-frontend/` | React app, routes, UI, auth integration, and frontend tests |
| `packages/sidequest-backend/`  | FastAPI upload and project-management API                   |
| `supabase/migrations/`         | Incremental SQL migrations for app features                 |
| `scripts/`                     | Project scripts                                             |
| `CONTRIBUTING.md`              | Branch, style, and commit conventions                       |
| `project-context.md`           | Product context and confirmed constraints for contributors  |
| `SRD - SideQuest.docx`         | Product requirements document                               |

## Get started locally

### Prerequisites

- Node.js and npm
- Python 3
- A Supabase project with the required database, Auth, and
  Storage configuration

### 1. Install dependencies

Run these commands from the repository root:

```sh
npm install
py -m venv .venv
```

Activate the virtual environment and install the backend
packages:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
python -m pip install -r packages/sidequest-backend/requirements.txt
```

```sh
# macOS / Linux
source .venv/bin/activate
python -m pip install -r packages/sidequest-backend/requirements.txt
```

### 2. Configure Supabase

Create `packages/sidequest-frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Create `packages/sidequest-backend/.env`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SECRET_KEY=your-server-side-secret-key
SUPABASE_STORAGE_BUCKET=project-media
```

Use the **same Supabase project** in both files. The frontend
key must be a publishable or legacy anon key. Keep the backend
secret key private: never put it in a `VITE_` variable, commit
it, or expose it to browser code. `.env` files are ignored by
Git.

In the Supabase dashboard, enable email/password authentication
and email confirmation. Set the local site URL to
`http://localhost:5173` and allow these redirect URLs:

- `http://localhost:5173/login`
- `http://localhost:5173/reset-password`

Create/configure the `project-media` Storage bucket (or set
`SUPABASE_STORAGE_BUCKET` to your bucket). Configure Supabase
Auth email delivery and Storage permissions for your
environment. For production, use your deployed site's URLs and
appropriate credentials.

### 3. Prepare the database

The SQL files in `supabase/migrations/` are **incremental
feature migrations**, not a complete schema for a brand-new
Supabase project. They expect the app's base tables and policies
to exist, including `public.profiles`, `public.user_hobbies`,
and `public.projects`. Ensure the foundational schema is
installed first, then apply the repository migrations in
filename order using your team's Supabase migration workflow or
the SQL Editor:

1. `202610150001_save_my_preferences.sql` — saves hobby
   preferences and onboarding completion.
2. `202610280001_beginner_friendly_projects.sql` — adds a legacy
   project field.
3. `202610280002_project_feed_filters.sql` — adds project hobby,
   skill-level, and display-name fields.
4. `202610280003_sidequest_events.sql` — creates events and RSVP
   tables with RLS policies.
5. `202610280004_user_follows.sql` — creates the one-way follow
   relationship.
6. `202610280005_communities.sql` — creates the public community
   directory.
7. `202610280006_community_hobby_optional.sql` — allows
   communities without a hobby.
8. `202610280007_hobby_categories.sql` — creates the shared
   hobby catalogue and updates hobby references.
9. `202610280008_community_memberships.sql` — creates community
   membership records.

The initial hobby catalogue seeds Photography, Gardening, and
Cooking. Hobby categories and experience levels are used by both
application code and database constraints, so changes should be
coordinated across the frontend and migrations. See the
[frontend README](./packages/sidequest-frontend/README.md) for
additional authentication and preference setup notes.

### 4. Start the app

Run the frontend and backend in separate terminals from the
repository root. Keep the Python virtual environment active in
the backend terminal.

```sh
# Terminal 1: Vite frontend
npm run dev --workspace=sidequest-frontend
```

```sh
# Terminal 2: FastAPI backend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The backend
listens on port 8000, and Vite forwards `/api` requests to it.
Supabase-backed features also require the database setup above.

## Useful commands

Run these from the repository root:

```sh
npm run dev --workspace=sidequest-frontend  # Start Vite
npm run dev                                 # Start FastAPI (activate .venv first)
npm run lint --workspace=sidequest-frontend # Lint frontend
npm run build --workspace=sidequest-frontend # Type-check and build frontend
npm test --workspace=sidequest-frontend     # Run frontend tests
npm run format                              # Format supported repository files
```

## Current limitations

- The migrations in this repository do not provision every
  foundational table or policy. A fresh Supabase project needs
  its base schema configured before applying the feature
  migrations.
- The direct-message UI calls Supabase tables (`rooms`,
  `room_participants`, and `messages`) and RPCs
  (`search_chat_users` and `chat_participant_names`). Their
  schema and function migrations are not included in the
  currently tracked migration set; messaging requires those
  objects to be provisioned separately.
- The starter-activity recommendations are separate from
  community-posted projects; they should not be assumed to be a
  personalized recommendation engine over all project content.
- Production deployment, live-user metrics, and operational
  policies are not specified here. Verify environment
  configuration, database access rules, and email/storage setup
  before deploying.

## Contributing

Use a branch for changes and do not push to `main` unless the
change is stable and production-ready. Follow the naming and
formatting conventions in [CONTRIBUTING.md](./CONTRIBUTING.md),
and consult [project-context.md](./project-context.md) before
making product or privacy assumptions. Keep personal information
and credentials out of commits, prompts, and test fixtures.
