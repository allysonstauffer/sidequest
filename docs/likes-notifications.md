# Likes and notifications

## Enable the feature

1. Run
   `supabase/migrations/202610290004_project_likes_notifications.sql`
   once in the Supabase SQL Editor for the project used by this
   app. It creates new tables, policies, functions, and a
   Realtime publication entry. It does not delete existing
   projects or profiles.
2. Restart the backend and frontend. The existing API base
   URL/proxy and Supabase credentials are reused; no new
   service-role key is needed.
3. With account A, publish a project. With account B, click its
   outlined heart. The heart turns red and the count increases
   after the save succeeds.
4. In account A, open the notification bell. A new unread like
   notification should appear without refreshing. Opening it
   marks it read and opens the project at
   `/projects/:projectId`.
5. Unlike as B: the heart becomes outlined, the count decreases,
   and A's alert disappears. Verify read status and like state
   survive reloads.

These are in-app notifications, not operating-system push
notifications. Likes on your own projects count but do not send
you alerts. Repeating an already-saved like does not create
another alert. Unliking and then liking again creates a new
alert. Comments and collaboration notifications are not included
in this migration.

## Implementation walkthrough

- `LikeButton.tsx` uses the existing Lucide `Heart` icon. An
  unliked heart has no fill; a liked heart has a red fill.
  `aria-pressed` exposes its state to assistive technology.
  Saving temporarily disables the button, and failed saves leave
  the last confirmed state intact.
- `ProjectFeed.tsx` loads like totals and your own liked state
  for the displayed projects in one `get_project_like_summaries`
  call. It does not download every like or make a request per
  card. Other users' new counts appear when the feed reloads;
  notification delivery is live.
- `likesApi.ts` sends POST to like and DELETE to unlike.
  Explicit actions make retries safe. Both requests carry the
  current user's token to FastAPI.
- `post_handling.py` validates authentication and calls
  `set_project_like` using that token. The database function
  respects project visibility and writes only the caller's like.
  The `(project_id, user_id)` unique constraint prevents
  duplicates, including simultaneous requests.
- A database trigger creates the owner notification in the same
  transaction as the like. If either write fails, both roll
  back. Recipient IDs, names, and project titles come from the
  database, not from browser input.
- On unlike, the trigger sets `dismissed_at` on the
  corresponding notification. Queries omit dismissed rows. This
  lets Realtime send an authorized UPDATE to remove the alert
  and update the unread count. Deleting the project removes its
  likes and notifications through foreign keys.
- `NotificationsProvider.tsx` runs once under the authentication
  provider, so navigation does not create a subscription per
  card or bell. It subscribes to the signed-in recipient's
  inserts/updates and refreshes the unread count on events,
  reconnection, browser focus, and returning online. Signing out
  or switching accounts clears the old state/subscription.
- `NotificationsPage.tsx` displays 30 alerts per page, supports
  marking one/all as read, and links to the exact project. It
  reloads after live events and offers manual Refresh if the
  connection is unavailable. Names and titles are snapshots from
  the time of the like.
- Row-level security restricts notifications to their recipient.
  Clients cannot create alerts, change recipients, or edit
  notification content. A guarded database function only marks
  the caller's alerts as read.

The Realtime subscription uses the existing Supabase client and
authenticated INSERT/UPDATE delivery described in
[Supabase's Postgres Changes documentation](https://supabase.com/docs/guides/realtime/postgres-changes).

## Verification

Run from the repository root:

```sh
npm run test:database
npm test --workspace=sidequest-frontend
npm run lint --workspace=sidequest-frontend
npm run build --workspace=sidequest-frontend
packages/sidequest-backend/.venv/bin/python -m unittest discover -s packages/sidequest-backend -p 'test_*.py'
```

The database tests use a fresh, in-memory PostgreSQL engine
(PGlite, a development-only dependency). They execute the real
migration and check privacy, spoofed identities, self-likes,
duplicate retries, unlike, read permissions, atomic rollback,
hidden projects, and deletion cleanup without connecting to
Supabase.

Browser testing also covers the outlined/filled heart, count
updates, failed-save recovery, persisted state, live badge/list
updates through mocked WebSocket events, notification links, and
mobile layout. A real two-account Supabase check is still
required after applying the migration to validate the deployed
policies and Realtime publication.
