# Follower notifications

Apply
`supabase/migrations/202610300001_follow_notifications.sql`
after the existing user-follows and likes/notifications
migrations. The existing Realtime publication and notification
recipient policies are reused. Existing follows are not
backfilled with alerts.

When someone follows you, the notification bell counts the new
unread alert and the notifications page shows “started following
you” with a **Follow back** button. Clicking the message marks
it read and opens the follower's profile. Following back changes
the button to **Following**; clicking it again unfollows.
Existing outgoing follows show **Following** on load. Following
back creates a notification for the other person too. These are
in-app notifications.

Notifications are created by a database trigger in the same
transaction as the follow. Repeated follows do not duplicate
alerts. Unfollowing dismisses the alert through a Realtime
update; following again creates a fresh unread alert. Names are
snapshots from the follower's profile. Only the recipient can
read or mark their notifications as read. Failed follow saves
retain the last confirmed button state and show an error. Failed
status loads offer Retry.

Verify with two accounts after applying the migration:

1. Follow A from B's profile view. A's bell should update live.
2. As A, open notifications, follow B back, then reload. The
   button should show Following and B should receive a follower
   alert.
3. Open A's follower message and confirm it navigates to B's
   profile and clears its unread state. Confirm project-like
   links still open projects.
4. Unfollow A as B. A's alert should disappear without
   refreshing. Follow A again and confirm one fresh unread alert
   appears.
5. Check notifications at mobile width and test a failed save or
   status request; the action should remain recoverable.

Automated database coverage runs with `npm run test:database`,
using the real migrations in an isolated PGlite database. It
covers follow-back, duplicate retries, privacy, spoofed
identities, read permissions, unfollow/refollow, rollback,
deletion, and coexistence with project likes.
