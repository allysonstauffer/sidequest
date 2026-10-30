# Collaboration requests

## Setup

1. Apply
   `supabase/migrations/202610290002_project_collaboration.sql`
   if it has not already been applied.
2. Run
   `supabase/migrations/202610290003_collaboration_requests.sql`
   once in the Supabase SQL Editor. It creates a new table,
   permissions, functions, and a Realtime publication entry. It
   does not delete existing projects or profiles.
3. Restart the FastAPI backend and frontend. Keep using the
   existing Supabase environment variables and API proxy/base
   URL. No new service-role credential is required.

## What users can do

- On the feed, a signed-in user can open **Request
  collaboration** on another user's project when its
  collaboration flag is enabled.
- They can write a message of up to 1,000 characters. Reopening
  the form shows an existing request instead of sending another.
- **Collaborations** in the sidebar opens `/collaborations`,
  with received and sent requests. Owners can accept or decline
  pending requests.
- The page listens for new requests and decisions, reloads after
  reconnecting or focusing the window, and has a manual Refresh
  button if Realtime is unavailable.
- Acceptance records agreement only. It does not grant
  project-editing access or create a chat. The notification
  bell, messaging, and collaborator permissions are separate
  follow-up features.

For this first version there is one request per user per
project, and decisions are final. A declined request cannot be
resubmitted. Closing the collaboration flag prevents new
requests but leaves existing pending requests available for a
decision. Deleting a project deletes its associated requests.
Titles and usernames are snapshots from the time of the request.

## How the pieces fit together

`ProjectFeed.tsx` shows `CollaborationRequestForm.tsx` only for
other users' open projects. The form first checks for an
existing request and then posts a message through
`collaborationApi.ts` to FastAPI.

The two FastAPI routes in `upload.py` validate input and the
user's token, then call database functions using that same
token. The request function uses the caller's permissions, so
existing project visibility rules still apply. A database
trigger derives the owner and names from real rows; the browser
cannot choose them. The unique constraint prevents duplicates
even if two requests arrive together.

The response function checks ownership and locks the request
before changing a pending status. Repeating the same decision is
safe, while a conflicting decision is rejected. Table RLS lets
only the sender and recipient read a request; clients cannot
directly change its status. Supabase Realtime uses these read
permissions when delivering updates.

`CollaborationsPage.tsx` loads the request lists, subscribes to
inserts/updates, and removes its subscription on unmount. It
reloads after connecting to cover events missed during initial
loading or a disconnected period.

## Verify after applying the migration

1. As account A, publish a project with **Looking for
   collaborators** checked.
2. As account B, find it in the feed and send a request. Verify
   that reopening the form shows `pending`.
3. Open A's Collaborations page. Accept the request and verify B
   sees `accepted`, including after refreshing. Use a second
   project to test Decline.
4. Check that A cannot request its own project and a third
   account cannot read or answer A/B's request.
5. Turn off the flag and verify that new requests are
   unavailable. A stale open form should receive an error from
   the server.

Local checks: `npm run lint --workspace=sidequest-frontend`,
`npm test --workspace=sidequest-frontend`,
`npm run build --workspace=sidequest-frontend`, and
`packages/sidequest-backend/.venv/bin/python -m unittest discover -s packages/sidequest-backend -p 'test_*.py'`.
