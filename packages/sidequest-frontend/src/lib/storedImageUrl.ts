// Only render images served by this application's Storage project. Values in
// database rows can be written through the Supabase API without using our UI.
export function storedImageUrl(
  value: unknown,
  bucket: "project-media" | "creator-avatars",
  ownerId: string
): string | null {
  if (typeof value !== "string") return null;
  const base = import.meta.env?.VITE_SUPABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(value);
    const expected = new URL(base);
    const folder = bucket === "project-media" ? `images/${ownerId}` : ownerId;
    const prefix = `/storage/v1/object/public/${bucket}/${folder}/`;
    const filename = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length)
      : "";
    return url.origin === expected.origin &&
      !url.username && !url.password && !url.search && !url.hash &&
      /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(filename)
      ? url.toString() : null;
  } catch {
    return null;
  }
}
