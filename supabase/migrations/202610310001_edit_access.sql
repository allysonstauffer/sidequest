-- Requires the projects, sidequests and profiles tables.
-- Owners grant or revoke edit access for a specific user. Access covers only
-- the agreed-upon details (projects: title, description, beginner flag and
-- experience level; sidequests: title, description, times, location, hobby and
-- experience level). It never covers ownership, deletion, access management or
-- the collaboration flag, and collaboration requests never create grants.
begin;

create table public.edit_access_grants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  sidequest_id uuid references public.sidequests(id) on delete cascade,
  collaborator_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((project_id is null) <> (sidequest_id is null))
);

create unique index edit_access_grants_project_unique
  on public.edit_access_grants(project_id, collaborator_id)
  where project_id is not null;
create unique index edit_access_grants_sidequest_unique
  on public.edit_access_grants(sidequest_id, collaborator_id)
  where sidequest_id is not null;
create index edit_access_grants_collaborator
  on public.edit_access_grants(collaborator_id);

alter table public.edit_access_grants enable row level security;
revoke all on public.edit_access_grants from public, anon, authenticated;
grant select on public.edit_access_grants to authenticated;

create policy edit_access_grants_read_participants
  on public.edit_access_grants for select to authenticated
  using ((select auth.uid()) in (collaborator_id, granted_by));

create function public.can_edit_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (p.author_id = auth.uid() or exists (
        select 1 from public.edit_access_grants g
        where g.project_id = p.id and g.collaborator_id = auth.uid()))
  );
$$;

create function public.can_edit_sidequest(p_sidequest_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.sidequests s
    where s.id = p_sidequest_id
      and (s.host_id = auth.uid() or exists (
        select 1 from public.edit_access_grants g
        where g.sidequest_id = s.id and g.collaborator_id = auth.uid()))
  );
$$;

create function public.set_edit_access(
  p_target_type text, p_target_id uuid, p_user_id uuid, p_allowed boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  owner_id uuid;
begin
  if caller is null then
    raise exception 'Sign in to manage edit access.' using errcode = '42501';
  end if;
  if p_target_type not in ('project', 'sidequest') or p_user_id is null
     or p_allowed is null then
    raise exception 'Choose a project or sidequest, a user and an access level.'
      using errcode = '22023';
  end if;

  if p_target_type = 'project' then
    select author_id into owner_id from public.projects where id = p_target_id;
  else
    select host_id into owner_id from public.sidequests where id = p_target_id;
  end if;
  if owner_id is distinct from caller then
    raise exception 'Only the owner can manage edit access.' using errcode = '42501';
  end if;
  if p_user_id = owner_id then
    raise exception 'The owner already has full access.' using errcode = '22023';
  end if;

  if p_allowed then
    if not exists (select 1 from public.profiles where id = p_user_id) then
      raise exception 'That user does not exist.' using errcode = '22023';
    end if;
    if p_target_type = 'project' then
      insert into public.edit_access_grants(project_id, collaborator_id, granted_by)
        values (p_target_id, p_user_id, caller)
        on conflict (project_id, collaborator_id) where project_id is not null
        do nothing;
    else
      insert into public.edit_access_grants(sidequest_id, collaborator_id, granted_by)
        values (p_target_id, p_user_id, caller)
        on conflict (sidequest_id, collaborator_id) where sidequest_id is not null
        do nothing;
    end if;
  elsif p_target_type = 'project' then
    delete from public.edit_access_grants
      where project_id = p_target_id and collaborator_id = p_user_id;
  else
    delete from public.edit_access_grants
      where sidequest_id = p_target_id and collaborator_id = p_user_id;
  end if;

  return jsonb_build_object(
    'target_type', p_target_type, 'target_id', p_target_id,
    'user_id', p_user_id, 'allowed', p_allowed);
end;
$$;

create function public.list_edit_access(p_target_type text, p_target_id uuid)
returns table (user_id uuid, username text, granted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if auth.uid() is null or p_target_type not in ('project', 'sidequest') then
    raise exception 'Only the owner can view edit access.' using errcode = '42501';
  end if;
  if p_target_type = 'project' then
    select author_id into owner_id from public.projects where id = p_target_id;
  else
    select host_id into owner_id from public.sidequests where id = p_target_id;
  end if;
  if owner_id is distinct from auth.uid() then
    raise exception 'Only the owner can view edit access.' using errcode = '42501';
  end if;
  return query
    select g.collaborator_id, coalesce(nullif(pr.username, ''), 'Hobbyist'), g.created_at
    from public.edit_access_grants g
    join public.profiles pr on pr.id = g.collaborator_id
    where (p_target_type = 'project' and g.project_id = p_target_id)
       or (p_target_type = 'sidequest' and g.sidequest_id = p_target_id)
    order by g.created_at;
end;
$$;

create function public.update_project_details(p_project_id uuid, p_changes jsonb)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare result public.projects;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating a project.' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_changes) k
       where k not in ('title', 'description', 'beginner_friendly', 'skill_level')) then
    raise exception 'Only title, description, beginner flag and experience level can be edited.'
      using errcode = '22023';
  end if;
  if not public.can_edit_project(p_project_id) then
    raise exception 'You do not have permission to edit this project.' using errcode = '42501';
  end if;
  if p_changes ? 'title' and char_length(btrim(coalesce(p_changes->>'title', ''))) not between 1 and 200 then
    raise exception 'Title must be 1 to 200 characters.' using errcode = '22023';
  end if;

  update public.projects p set
    title = case when p_changes ? 'title' then btrim(p_changes->>'title') else p.title end,
    description = case when p_changes ? 'description' then nullif(btrim(p_changes->>'description'), '') else p.description end,
    beginner_friendly = case when p_changes ? 'beginner_friendly'
      then coalesce((p_changes->>'beginner_friendly')::boolean, false) else p.beginner_friendly end,
    skill_level = case when p_changes ? 'skill_level' then p_changes->>'skill_level' else p.skill_level end
  where p.id = p_project_id
  returning p.* into result;
  return result;
end;
$$;

create function public.update_sidequest_details(p_sidequest_id uuid, p_changes jsonb)
returns public.sidequests language plpgsql security definer set search_path = '' as $$
declare result public.sidequests;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating a sidequest.' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_changes) k
       where k not in ('title', 'description', 'starts_at', 'ends_at',
                       'location', 'hobby', 'skill_level')) then
    raise exception 'Only sidequest details can be edited.' using errcode = '22023';
  end if;
  if not public.can_edit_sidequest(p_sidequest_id) then
    raise exception 'You do not have permission to edit this sidequest.' using errcode = '42501';
  end if;

  update public.sidequests s set
    title = case when p_changes ? 'title' then btrim(p_changes->>'title') else s.title end,
    description = case when p_changes ? 'description' then coalesce(btrim(p_changes->>'description'), '') else s.description end,
    starts_at = case when p_changes ? 'starts_at' then (p_changes->>'starts_at')::timestamptz else s.starts_at end,
    ends_at = case when p_changes ? 'ends_at' then (p_changes->>'ends_at')::timestamptz else s.ends_at end,
    location = case when p_changes ? 'location' then btrim(p_changes->>'location') else s.location end,
    hobby = case when p_changes ? 'hobby' then p_changes->>'hobby' else s.hobby end,
    skill_level = case when p_changes ? 'skill_level' then p_changes->>'skill_level' else s.skill_level end
  where s.id = p_sidequest_id
  returning s.* into result;
  return result;
end;
$$;

revoke all on function public.can_edit_project(uuid) from public, anon;
revoke all on function public.can_edit_sidequest(uuid) from public, anon;
revoke all on function public.set_edit_access(text, uuid, uuid, boolean) from public, anon;
revoke all on function public.list_edit_access(text, uuid) from public, anon;
revoke all on function public.update_project_details(uuid, jsonb) from public, anon;
revoke all on function public.update_sidequest_details(uuid, jsonb) from public, anon;
grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.can_edit_sidequest(uuid) to authenticated;
grant execute on function public.set_edit_access(text, uuid, uuid, boolean) to authenticated;
grant execute on function public.list_edit_access(text, uuid) to authenticated;
grant execute on function public.update_project_details(uuid, jsonb) to authenticated;
grant execute on function public.update_sidequest_details(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
