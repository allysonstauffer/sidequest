function apiUrl(path: string) {
  const baseUrl = import.meta.env?.VITE_API_BASE_URL ?? "";
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function readResult(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof result?.detail === "string" && result.detail
        ? result.detail
        : `Request failed (${response.status}). Please try again.`
    );
  }
  return result;
}

export async function publishProject(
  formData: FormData,
  accessToken: string
) {
  const response = await fetch(apiUrl("/api/upload"), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData
  });
  const result = await readResult(response);
  if (
    typeof result?.project?.id !== "string" ||
    !result.project.id.trim()
  ) {
    throw new Error(
      "The server did not confirm your post. Check your feed before trying again."
    );
  }
}

export async function deleteProject(
  id: string,
  accessToken: string
) {
  const response = await fetch(
    apiUrl(`/api/upload?id=${encodeURIComponent(id)}`),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const result = await readResult(response);
  if (result?.deleted !== true) {
    throw new Error(
      "The server did not confirm deletion. Refresh your posts before trying again."
    );
  }
  return { mediaCleanup: result.media_cleanup !== false };
}
