-- Requires the existing projects table with id and author_id columns.
-- Adds a collaboration flag (default false) and an authenticated-only RPC
-- that lets project owners update their own projects.
-- Does not change existing RLS policies or public-read permissions.

begin;

alter table public.projects
  add column if not exists looking_for_collaborators
  boolean not null default false;

create or replace function public.set_project_collaboration(
  p_project_id uuid,
  p_looking_for_collaborators boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_flag boolean;
begin
  if current_user_id is null then
    raise exception 'Sign in before updating a project.'
      using errcode = '42501';
  end if;

  if p_looking_for_collaborators is null then
    raise exception 'The collaboration flag must be true or false.'
      using errcode = '22023';
  end if;

  update public.projects
  set looking_for_collaborators = p_looking_for_collaborators
  where id = p_project_id
    and author_id = current_user_id
  returning looking_for_collaborators into saved_flag;

  if not found then
    raise exception 'Project not found or you do not own it.'
      using errcode = '42501';
  end if;

  return saved_flag;
end;
$$;

revoke all
on function public.set_project_collaboration(uuid, boolean)
from public, anon;

grant execute
on function public.set_project_collaboration(uuid, boolean)
to authenticated;

notify pgrst, 'reload schema';

commit;