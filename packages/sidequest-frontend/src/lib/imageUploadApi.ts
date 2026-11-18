function apiUrl(path: string) {
  const base = import.meta.env?.VITE_API_BASE_URL ?? "";
  return `${base.replace(/\/+$/, "")}${path}`;
}

async function uploadImage(path: string, file: File, token: string) {
  const body = new FormData();
  body.set("attachment", file);
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(typeof result?.detail === "string" ? result.detail : "Could not upload the image.");
  if (typeof result?.path !== "string" || !result.path)
    throw new Error("The server did not confirm the image upload.");
  return result as { path: string; url?: string };
}

export function uploadAvatar(file: File, token: string) {
  return uploadImage("/api/images/avatar", file, token);
}

export function uploadMessageImage(roomId: string, file: File, token: string) {
  return uploadImage(`/api/images/dm/${encodeURIComponent(roomId)}`, file, token);
}
