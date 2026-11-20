# Edit access

Owners of a project or sidequest can grant or revoke edit access for a specific user.

- Migration: `supabase/migrations/202610310001_edit_access.sql` (apply it in Supabase).
- Grants live in `edit_access_grants`; they are only written through the `set_edit_access` RPC, which only the owner can call.
- Collaboration requests are separate: accepting one never grants edit access.
- Editing goes through `update_project_details` / `update_sidequest_details`, which allow the owner or a grantee and only touch whitelisted detail fields. Ownership, authorship, media and collaboration flags are not editable this way.
- Backend: `GET/PUT /api/{projects|sidequests}/{id}/editors`, `DELETE /api/{projects|sidequests}/{id}/editors/{user_id}`.
- UI: "Manage editors" in the owner's project/sidequest menu; collaborators get "Edit" on the project detail page and sidequest cards.
