# Unread message badges

Apply `supabase/migrations/202610300003_unread_messages.sql` in
the Supabase project used by the app, after provisioning the
existing `rooms`, `room_participants`, and `messages` tables.
The migration infers their ID types and preserves their existing
policies. It adds private receipt rows, guarded count/read RPCs,
a message-insert trigger, and a Realtime publication entry.

The Messages navigation tab shows a red badge with the total
number of unread incoming messages across your chats. Each chat
also shows its own unread count. Counts above 99 display `99+`;
accessible labels include the full number. Zero hides the badge.
The feed shortcut and mobile navigation share the same count.

New direct and group messages create an unread receipt for each
current participant except the sender. Reading a conversation
acknowledges its loaded incoming messages and older history;
messages that arrive after the loaded batch stay unread until
loaded. Other chats stay unread. Conversations are marked read
only while the page is visible and focused. Read state is stored
in the database and shared across reloads and devices.

Old messages start without unread receipts because the app did
not track whether they had been read. Only messages sent after
the migration contribute to the badge. Opening Messages selects
the first chat using the existing behavior, so that conversation
is read once its history is loaded and the window is focused.

One provider subscribes to the signed-in recipient's receipt
inserts/updates. It also reconciles on focus, reconnect,
returning online, and every 15 seconds while visible. Signing
out or switching accounts clears the subscription and cached
counts. Deleted messages/rooms remove their receipts; counts
reconcile on the next refresh. Removed participants cannot read
or count their old receipts. Read/count failures can be retried
in Inbox.

Verify using two accounts after applying the migration:

1. Keep A on the feed and send A two messages from B. A's
   Messages badge should show 2 without refreshing.
2. Reload A's page; the badge should remain 2. Send a message to
   A in a second chat; the total should become 3.
3. Open the first chat as A; its count should clear and the
   navigation badge should retain the second chat's count.
4. Send into the open chat while A's page is focused, then while
   A's tab is hidden. The focused chat should clear incoming
   messages after loading them; the hidden chat stays unread.
5. Check a group chat: each other participant has an independent
   count, and the sender's count does not increase.

Run `npm run test:database`,
`npm test --workspace=sidequest-frontend`,
`npm run lint --workspace=sidequest-frontend`, and
`npm run build --workspace=sidequest-frontend` for local checks.
The database tests execute the real migration with UUID and
integer message IDs and cover per-room counts, group recipients,
read boundaries, permissions, membership removal, and cleanup.
