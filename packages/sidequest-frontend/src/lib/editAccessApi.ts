export type EditAccessTarget = "project" | "sidequest";

export type Editor = {
  user_id: string;
  username: string | null;
  granted_at?: string;
};

function url(target: EditAccessTarget, id: string, suffix = "") {
  const baseUrl = import.meta.env?.VITE_API_BASE_URL ?? "";
  return `${baseUrl.replace(/\/+$/, "")}/api/${target}s/${encodeURIComponent(id)}/editors${suffix}`;
}

async function request(
  input: string,
  accessToken: string,
  init: { method: string; body?: unknown }
) {
  const response = await fetch(input, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
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

export async function listEditors(
  target: EditAccessTarget,
  id: string,
  accessToken: string
): Promise<Editor[]> {
  const result = await request(url(target, id), accessToken, { method: "GET" });
  return Array.isArray(result?.editors) ? result.editors : [];
}

export async function grantEditAccess(
  target: EditAccessTarget,
  id: string,
  userId: string,
  accessToken: string
) {
  const result = await request(url(target, id), accessToken, {
    method: "PUT",
    body: { user_id: userId }
  });
  if (result?.allowed !== true) {
    throw new Error("The server did not confirm the change. Refresh before retrying.");
  }
}

export async function revokeEditAccess(
  target: EditAccessTarget,
  id: string,
  userId: string,
  accessToken: string
) {
  const result = await request(
    url(target, id, `/${encodeURIComponent(userId)}`),
    accessToken,
    { method: "DELETE" }
  );
  if (result?.allowed !== false) {
    throw new Error("The server did not confirm the change. Refresh before retrying.");
  }
}
