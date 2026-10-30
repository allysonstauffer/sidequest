# Images in direct messages

Apply `supabase/migrations/202610300004_message_images.sql` once
in the Supabase project used by the app. It requires the
existing chat tables and Supabase Storage. Apply the
unread-message migration too if unread badges are enabled.

The migration adds an optional `messages.image_path`, a private
`dm-images` bucket, storage policies, and an
attachment-validation trigger. Existing text messages and chat
policies are preserved. The new restrictive storage policies
protect this bucket even when older buckets have broad
permissive policies.

In a conversation, click the image icon beside the message box.
Choose a JPG, PNG, or WebP under 10 MB, review the thumbnail,
add an optional caption, and send. Remove the preview with its
X. The existing image compressor reduces uploads before sending.
An image without a caption uses “Photo” as its message text so
existing nonempty-text constraints remain compatible.

Images appear inside message bubbles and open at full size in a
new tab when clicked. Image messages use the existing unread
receipt trigger. An attachment belongs to the conversation in
which it was selected and is not sent into a different chat.
Chat switching is disabled during sending. A failed send retains
the preview and caption for retry.

Storage paths include conversation and sender IDs. Uploads
require membership and the sender's own folder. Other
participants can read an image only after it is attached to a
message. Outsiders and anonymous clients cannot read it. Files
are immutable through the client; only the uploader can clean up
unused uploads. The validation trigger rejects missing files,
another sender's file, and files from another conversation.

Viewing uses five-minute signed URLs refreshed while the message
is displayed. Like other bearer links, an already-issued signed
URL remains usable until it expires. New links require current
membership. This follows
[Supabase's private bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Uploads happen before message insertion. Definite database
rejections trigger best-effort cleanup. If a send response is
lost, the client first looks for the committed image message.
Uncertain failures retain the object to avoid deleting a photo
whose message may have saved; check the chat before retrying.
Unreferenced files from interrupted/uncertain sends, or deleted
conversations, may require later storage maintenance. Existing
sent-image deletion is not exposed by this feature.

Verify after applying the migration:

1. Send an image with a caption from A to B. Check preview,
   delivery, reload persistence, and B's unread count.
2. Send an image without text, then a text-only reply.
3. Remove and reselect a preview, and check mobile layout.
4. Disconnect during upload or reject the save. The caption and
   preview should remain available; retry after reconnecting.
5. Confirm an outsider cannot read or upload into the room, and
   a participant removed from the room cannot request new links.

`npm run test:database` covers the real migration and policy
behavior, including broad legacy storage policies, image-path
spoofing, cleanup restrictions, and unread receipts. The tests
use PGlite storage metadata tables; production Storage API byte
limits, signed URL delivery, and two-account behavior still need
a deployed Supabase check. Frontend tests cover upload/save
failures, image-only sends, captions, account changes, and lost
response recovery.
