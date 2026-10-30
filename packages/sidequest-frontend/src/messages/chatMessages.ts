import type { SupabaseClient } from "@supabase/supabase-js";

export const MESSAGE_FIELDS =
  "id, room_id, sender_id, text, image_path, created_at";
export const MESSAGE_IMAGE_BUCKET = "dm-images";
export const MAX_MESSAGE_IMAGE_BYTES = 10 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  text: string;
  image_path: string | null;
  created_at: string;
};

export function validateMessageImage(
  file: Pick<File, "type" | "size">
) {
  if (!Object.hasOwn(extensions, file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (!file.size || file.size > MAX_MESSAGE_IMAGE_BYTES)
    throw new Error("Choose an image under 10 MB.");
}

export function parseChatMessage(value: unknown): ChatMessage {
  if (!value || typeof value !== "object")
    throw new Error(
      "The server did not confirm your message. Check the chat before retrying."
    );
  const row = value as Record<string, unknown>;
  if (
    (typeof row.id !== "string" &&
      typeof row.id !== "number") ||
    (typeof row.room_id !== "string" &&
      typeof row.room_id !== "number") ||
    typeof row.sender_id !== "string" ||
    typeof row.text !== "string" ||
    typeof row.created_at !== "string" ||
    (row.image_path !== null &&
      typeof row.image_path !== "string")
  ) {
    throw new Error(
      "The server did not confirm your message. Check the chat before retrying."
    );
  }
  return {
    id: String(row.id),
    room_id: String(row.room_id),
    sender_id: row.sender_id,
    text: row.text,
    image_path: row.image_path,
    created_at: row.created_at
  };
}

export async function sendChatMessage(
  client: Pick<SupabaseClient, "auth" | "from" | "storage">,
  input: {
    roomId: string;
    userId: string;
    text: string;
    image?: File | null;
  }
): Promise<ChatMessage> {
  const text = input.text.trim();
  if (!text && !input.image)
    throw new Error("Write a message or choose an image.");
  if (input.image) validateMessageImage(input.image);
  const { data: auth, error: authError } =
    await client.auth.getSession();
  if (authError || auth.session?.user.id !== input.userId)
    throw new Error("Please sign in again before sending.");
  let imagePath: string | null = null;
  const storage = client.storage.from(MESSAGE_IMAGE_BUCKET);
  if (input.image) {
    imagePath = `${input.roomId}/${input.userId}/${crypto.randomUUID()}.${extensions[input.image.type]}`;
    const { error } = await storage.upload(
      imagePath,
      input.image,
      { contentType: input.image.type, upsert: false }
    );
    if (error)
      throw new Error(
        "Could not upload your photo. Please try again."
      );
  }
  const confirm = (value: unknown) => {
    const message = parseChatMessage(value);
    if (
      message.room_id !== String(input.roomId) ||
      message.sender_id !== input.userId ||
      message.image_path !== imagePath
    ) {
      throw new Error(
        "The server did not confirm your message. Check the chat before retrying."
      );
    }
    return message;
  };
  const { data, error } = await client
    .from("messages")
    .insert({
      room_id: input.roomId,
      sender_id: input.userId,
      text: text || "Photo",
      image_path: imagePath
    })
    .select(MESSAGE_FIELDS)
    .single();
  if (error && imagePath) {
    // Recover a committed image message if only its response was lost.
    const saved = await client
      .from("messages")
      .select(MESSAGE_FIELDS)
      .eq("image_path", imagePath)
      .maybeSingle();
    if (!saved.error && saved.data) return confirm(saved.data);
    // Clean up only definite database rejections. A network failure may have
    // committed; retain that object and let the user reconcile with history.
    if (!saved.error && /^(23|22|42)/.test(error.code ?? "")) {
      await storage.remove([imagePath]).catch(() => {});
    }
  }
  if (error)
    throw new Error(
      "Could not send your message. Check the chat, then try again."
    );
  return confirm(data);
}
