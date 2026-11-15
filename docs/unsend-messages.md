# Unsend messages

Apply `supabase/migrations/202611150001_unsend_messages.sql`
once in the Supabase SQL editor before running the updated
frontend. It requires the existing chat tables, unread-message
migration, and message-image migration. No FastAPI changes are
needed because chat writes use Supabase directly.

Your own messages show **Undo send** for two minutes after
sending. Clicking it removes the text and photo for everyone and
leaves **You unsent a message** for the sender or **[username]
unsent a message** for other participants. This works in direct
and group chats, including after reloading. The action
disappears when the window expires. Rejected or unconfirmed
requests display an error without claiming success.

The database checks the authenticated sender, current room
membership, and the original server timestamp. The deadline is
strictly before `created_at + 2 minutes`. New messages receive a
server timestamp, and restrictive policies prevent direct client
updates/deletes from bypassing the deadline, changing ownership,
or restoring removed content. The guarded RPC locks the row and
replaces its text with a tombstone, clears its image path, and
records `unsent_at`. Retries are idempotent. Existing read and
insert policies are preserved; direct client editing and hard
deletion of individual messages are blocked.

Unsent content no longer contributes to unread counts. Open
chats receive Realtime updates and keep the existing five-second
poll as a fallback. Stale responses cannot restore an unsent
message in the UI.

Photos are detached in the same transaction as the unsend. The
sender's client also attempts to remove the unused file without
delaying the notice. A failed cleanup may leave an unreferenced
object requiring later maintenance. Recipients cannot request
new signed links to detached photos. Previously issued image
links can remain usable until expiration if cleanup fails.

Local verification:

```sh
npm run test:database
npm test --workspace=sidequest-frontend
npm run lint --workspace=sidequest-frontend
npm run build --workspace=sidequest-frontend
```

Database tests execute the migration with UUID and integer
message IDs, legacy permissive policies, and image/unread
integration. Frontend tests cover the deadline, account changes,
confirmed responses, and stale-response handling.

After applying the migration, verify with two accounts:

1. Send text and a photo. Use **Undo send** before two minutes;
   both accounts should see the notice without refreshing.
2. Reload both accounts and confirm the content stays removed.
3. Leave a message unread, unsend it, and confirm the
   recipient's unread count drops.
4. Wait two minutes. The action should disappear and a direct
   RPC request should also be rejected.
5. Confirm a recipient cannot unsend the sender's message. Check
   the same behavior in a group chat and at mobile widths.
