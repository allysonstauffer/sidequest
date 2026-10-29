# SideQuest

SideQuest is a social platform concept for hobbies and personal
projects. It is intended to help people share what they are
making, discover interests and communities, and connect with
others who enjoy the same things.

Not every meaningful social connection starts with work or a
polished achievement. SideQuest is for the things people do
because they are curious, creative, or having fun.

## Who it is for

The intended audience is hobbyists at every experience level:

- People just getting started who want ideas or encouragement.
- Makers and creatives who want to share projects and works in
  progress.
- People who want to connect or collaborate around a shared
  interest.
- Community members who want to discover others with similar
  interests.

This describes the product's intended users, not the size or
activity of a production user base.

## Product direction and current state

The product vision is to bring project sharing, interest
discovery, and community connection into one welcoming social
space. The current `main` branch is an early prototype; not
every destination in the interface is connected to working
product functionality.

| Area                                              | Current state in `main`                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts                                          | Email/password signup and login, confirmation email flow, logout, and password recovery through Supabase Auth.                                    |
| Projects                                          | Signed-in users can upload an image with a title and description. The feed shows recent projects, and a user can view and delete their own posts. |
| Profiles                                          | A basic signed-in profile displays the account email and the user's posts.                                                                        |
| Landing and discovery                             | A public landing page introduces the product and displays hobby/community discovery content.                                                      |
| Community, search, messages, settings, and browse | These destinations are present in the interface, but are placeholders or have limited functionality in this branch.                               |

Community discovery and connection are central to the product
direction, but the current branch should not be read as a
complete social network or production-ready service.

## Why SideQuest matters

Hobbies are a way to learn, make things, and connect outside of
work or school. SideQuest aims to make those interests easier to
share and discover: someone can show a project, find
inspiration, and eventually meet others around an activity they
already enjoy. Its focus is shared interest and participation
rather than professional networking.

## Technology

| Area                    | Technologies                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| Frontend                | React 19, TypeScript, Vite 8, React Router                        |
| UI and assets           | CSS, Lucide React, browser-image-compression                      |
| Backend API             | Python, FastAPI, Uvicorn                                          |
| Image processing        | Pillow, python-multipart                                          |
| Data and authentication | Supabase Auth, PostgreSQL, Supabase JavaScript and Python clients |
| Developer tooling       | npm workspaces, TypeScript, ESLint, Prettier                      |

## Architecture

This repository is an npm-workspace monorepo with a React
single-page app and a small FastAPI service:

1. The frontend uses Supabase for authentication and reads
   project records from the Supabase database.
2. The FastAPI service handles image uploads and project
   deletion. During local development, Vite proxies `/api`
   requests to `http://127.0.0.1:8000`.
3. Supabase provides hosted authentication, PostgreSQL, and
   object storage. The database schema, access policies, and
   storage configuration must be set up in the Supabase project.

The upload API accepts JPEG, PNG, or WebP images, limits source
files to 10 MB and 25 megapixels, corrects image orientation,
and stores a resized JPEG in Supabase Storage. The default
bucket is `project-media`.

## Repository map

| Path                           | Contents                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| `packages/sidequest-frontend/` | React app, routes, UI, authentication integration, and frontend tests |
| `packages/sidequest-backend/`  | FastAPI upload and project-deletion API                               |
| `CONTRIBUTING.md`              | Branch, style, and commit conventions                                 |
| `project-context.md`           | Product context and contributor constraints                           |
| `SRD - SideQuest.docx`         | Product requirements document                                         |

## Get started locally

### Prerequisites

- Node.js and npm
- Python 3
- A Supabase project with Auth, the expected database tables,
  and Storage configured

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
`SUPABASE_STORAGE_BUCKET` to your bucket). Configure Auth email
delivery and Storage permissions for your environment. For
production, use your deployed site's URLs and appropriate
credentials.

### 3. Prepare the database

The `main` branch does not include a complete database bootstrap
or tracked Supabase migration set. Configure the schema and
access policies in your Supabase project before using
database-backed features.

At minimum, the project upload and feed code expects a
`public.projects` table with `id`, `author_id`, `title`,
`description`, `media_urls`, and `created_at` fields.
Authentication is provided by Supabase Auth. Set appropriate
database permissions and Row Level Security (RLS) policies; the
frontend route guards are not a replacement for database
authorization.

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
npm run dev --workspace=sidequest-frontend   # Start Vite
npm run dev                                  # Start FastAPI (activate .venv first)
npm run lint --workspace=sidequest-frontend  # Lint frontend
npm run build --workspace=sidequest-frontend # Type-check and build frontend
npm run test:auth --workspace=sidequest-frontend # Run auth tests
npm run format                               # Format supported repository files
```

## Current limitations

- The database schema and RLS setup required by the app are not
  provisioned by migrations tracked on `main`; arrange the
  Supabase setup before expecting account-backed project
  features to work.
- Community, search, messages, settings, and browse screens are
  incomplete placeholders in this branch.
- The project is an evolving prototype. Production deployment,
  live-user metrics, and operational policies are not specified
  here. Verify environment configuration, database access rules,
  and email/storage setup before deploying.

## Contributing

Use a branch for changes and do not push to `main` unless the
change is stable and production-ready. Follow the naming and
formatting conventions in [CONTRIBUTING.md](./CONTRIBUTING.md),
and consult [project-context.md](./project-context.md) before
making product or privacy assumptions. Keep personal information
and credentials out of commits, prompts, and test fixtures.
