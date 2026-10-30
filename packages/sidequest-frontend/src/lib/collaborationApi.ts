export type CollaborationRequest = {
  id: string;
  project_id: string;
  requester_id: string;
  owner_id: string;
  project_title: string;
  requester_name: string;
  owner_name: string;
  message: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
};

export async function saveCollaboration(
  path: string,
  body:
    { message: string } | { status: "accepted" | "declined" },
  token: string
): Promise<CollaborationRequest> {
  const base = import.meta.env?.VITE_API_BASE_URL ?? "";
  const response = await fetch(
    `${base.replace(/\/+$/, "")}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : "Could not save the collaboration request. Please try again."
    );
  }
  if (
    !result?.request?.id ||
    !["pending", "accepted", "declined"].includes(
      result.request.status
    )
  ) {
    throw new Error(
      "The server did not confirm the request. Refresh before retrying."
    );
  }
  return result.request;
}
