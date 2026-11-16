# Email notifications

New notifications in the existing SideQuest notification inbox
also create an email delivery job. Covered events are project
likes, follows, project and sidequest comments, adding a
sidequest co-host, and new project collaboration requests. The
recipient is the project author, sidequest host, new co-host,
followed user, or project owner, respectively. Self-comments do
not notify the author. Emails include the actor and relevant
project/sidequest title; links open the project, profile,
collaboration inbox, or sidequest feed. Future inbox
notification types receive a generic email linking to
`/notifications` until a specific template is added. Direct
messages do not create email alerts.

The existing in-app notification list, read state, and Supabase
Realtime updates continue to work. FastAPI subscribes to
Supabase Realtime `INSERT` events on `public.notifications`.
Each event wakes the backend email worker, which claims a
private queued job and sends the email through SMTP. Email
delivery runs on the FastAPI server, so the recipient does not
need the app open.

Flow: **notification created → Supabase Realtime → FastAPI →
SMTP email**. The database outbox makes retries and recovery
possible without relying on a browser staying connected.

## Configure delivery

Supabase's built-in verification emails are an Auth feature.
Custom application notifications need an email sender with SMTP
credentials. These credentials are configured separately in the
backend; configuring Auth's SMTP in the dashboard alone does not
configure this worker. See
[Supabase's SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

1. Obtain an SMTP host, port, username, password, and permitted
   sender address from an email provider. Use the provider's
   verified sender/domain requirements. Keep credentials in the
   backend environment, never in frontend `VITE_` variables.
2. Apply the migrations in this order in the Supabase SQL
   editor, after the existing likes, follow notifications,
   sidequests, projects, profiles, and collaboration-request
   migrations:

   - `supabase/migrations/202611150002_notification_emails.sql`
   - `supabase/migrations/202611160001_comment_cohost_tables.sql`
   - `supabase/migrations/202611160002_social_notification_events.sql`

   The first migration reuses the `supabase_realtime`
   publication for `notifications`; the private outbox is not
   published. The second creates the comment and co-host tables
   expected by the UI on `main`. The third connects those
   actions and project collaboration requests to the
   notification inbox and outbox. It only queues events created
   after it is applied; it does not backfill earlier comments,
   co-hosts, or requests.

3. Add the following values to
   `packages/sidequest-backend/.env`. The tracked `.env.example`
   documents the same settings with placeholders. Preserve your
   existing configuration and replace all sample values.

   ```dotenv
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SECRET_KEY=your-backend-secret-key
   NOTIFICATION_EMAIL_ENABLED=true
   SIDEQUEST_APP_URL=http://localhost:5173
   NOTIFICATION_EMAIL_FROM=notifications@your-verified-domain.example
   SMTP_HOST=smtp.your-provider.example
   SMTP_PORT=587
   SMTP_SECURITY=starttls
   SMTP_USERNAME=your-smtp-username
   SMTP_PASSWORD=your-smtp-password
   ```

   A legacy `SUPABASE_SERVICE_ROLE_KEY` can be used instead of
   `SUPABASE_SECRET_KEY`. An anon/publishable key cannot access
   the private delivery functions. With both server key
   variables set, `SUPABASE_SERVICE_ROLE_KEY` takes precedence.
   `SUPABASE_KEY` is not used by this privileged worker.

   For implicit TLS, use `SMTP_SECURITY=ssl` and the provider's
   port, commonly 465. Remote SMTP always uses TLS. Plain SMTP
   is supported only on localhost for a local mail-capture
   server; set `SMTP_SECURITY=plain`, its local host/port, and
   omit username/password if it does not require authentication.

4. Set `SIDEQUEST_APP_URL` to the deployed HTTPS frontend URL in
   production. HTTP is allowed only on localhost for
   development. Restart the backend with the usual launcher:

   ```sh
   sh scripts/run_all.sh local
   ```

   The worker starts automatically when
   `NOTIFICATION_EMAIL_ENABLED=true`. Delivery is disabled by
   default, so the rest of the app can run without an SMTP
   account. If explicitly enabled but required settings are
   missing or invalid, backend startup reports a configuration
   error. No packages beyond the existing backend dependencies
   are required.

Keep a persistent FastAPI process running for automatic email
delivery. If the server is stopped, jobs remain in the database
and are processed after it restarts. This worker should run in a
persistent process rather than a request-only serverless
runtime. Applying the migration queues new inbox events even
while delivery is disabled; enabling it later processes that
pending queue. Existing notifications from before the migration
are not backfilled.

## Delivery behavior

- A database trigger creates one outbox job per new notification
  in the same transaction. A rolled-back event cannot send an
  email. Duplicate like/follow retries and duplicate
  collaboration requests do not create extra jobs. A co-host
  removal dismisses a pending invitation alert; an already sent
  email cannot be recalled.
- FastAPI listens to Supabase Realtime notification inserts and
  immediately wakes the delivery worker. Startup and successful
  subscriptions/reconnections also trigger reconciliation.
  Bursts drain in batches of ten, with one email claimed at a
  time. A row lock and five-minute lease keep multiple workers
  from handling the same active job. Crashed jobs become
  eligible again after the lease expires.
- A 30-second queue check recovers missed events, scheduled
  retries, and expired leases if Realtime is unavailable.
  Subscription errors reconnect automatically. Shutdown closes
  the Realtime subscription and stops the worker. Realtime
  payloads only wake delivery; recipient information always
  comes from the guarded database function.
- The recipient address comes from the notification recipient's
  current verified Supabase Auth account. Clients cannot choose
  an arbitrary recipient, access account emails, or invoke the
  claim/acknowledgement functions. Outbox rows are private to
  the backend service role and database administrators.
- Both plain-text and escaped HTML email bodies are provided.
  SMTP header fields and links cannot be injected through names
  or titles. Provider error details and email addresses are not
  written to delivery logs or the queue's error field.
- Reading an alert does not resend it or cancel its queued
  email. Dismissed alerts, unavailable recipients, and accounts
  without a verified email are skipped before delivery.
  Following or liking again after removing the original action
  creates a fresh inbox event and a fresh email job. An email
  already accepted by SMTP cannot be recalled.
- Failed delivery retries after 30 seconds, then exponential
  backoff, up to eight attempts. Inspect
  `public.notification_email_outbox` in the SQL editor for
  `pending`, `processing`, `sent`, `cancelled`, and `failed`
  jobs. `last_error` contains a generic failure reason. After
  fixing configuration, an administrator can requeue failed jobs
  if desired.
- Every retry uses a stable `Message-ID`. A timeout or crash
  after the provider accepts an email but before the database
  records success can result in a duplicate. A `sent` job means
  SMTP accepted the message, not that the recipient has read it
  or that it reached the inbox rather than spam.

## Verify

Run the automated checks from the repository root:

```sh
.venv/bin/python -m unittest discover -s packages/sidequest-backend -p 'test_*.py'
npm run test:database
```

Backend tests mock SMTP and exercise templates, injection
protection, TLS, account destinations, success/failure handling,
worker startup/shutdown, Realtime insert subscriptions,
event-driven wakeups, reconnection, and cleanup. Database tests
execute the real migration and existing notification triggers
with PGlite to check permissions, duplicates, leases, retries,
rollback, dismissals, verification, and deletion. Tests do not
send real emails or modify the hosted database.

After configuring SMTP and applying the migrations, use two test
accounts with confirmed email addresses. Follow A or
like/comment on A's project from B; comment on A's sidequest;
have A add B as a co-host; and send A a project collaboration
request. Verify each recipient's inbox alert and email agree,
FastAPI reports the Realtime subscription connected, links open
the intended page, and the outbox jobs become `sent`. Repeat
with a recipient browser closed. Retry saved
likes/follows/requests to confirm there is no extra email. Test
unlike/unfollow or co-host removal before delivery, read-state
changes, and an SMTP failure followed by recovery. These live
checks require actual provider credentials and a working
Supabase server key.
