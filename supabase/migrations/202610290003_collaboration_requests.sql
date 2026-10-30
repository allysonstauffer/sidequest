-- Requires 202610290002_project_collaboration.sql. Apply once in Supabase.
begin;

create table public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_title text not null,
  requester_name text not null,
  owner_name text not null,
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (project_id, requester_id),
  check (requester_id <> owner_id)
);

create index collaboration_requests_owner_created
  on public.collaboration_requests(owner_id, created_at desc);
create index collaboration_requests_requester_created
  on public.collaboration_requests(requester_id, created_at desc);

alter table public.collaboration_requests enable row level security;
revoke all on public.collaboration_requests from public, anon, authenticated;
grant select on public.collaboration_requests to authenticated;
-- Callers cannot supply an owner, status, timestamps, or display names.
grant insert (project_id, requester_id, message)
  on public.collaboration_requests to authenticated;

create policy collaboration_requests_read_participants
  on public.collaboration_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, owner_id));

create policy collaboration_requests_insert_self
  on public.collaboration_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.looking_for_collaborators
        and p.author_id <> (select auth.uid())
    )
  );

-- Lock the project so requests and closing its flag cannot race. Display
-- snapshots avoid giving request participants extra access to profile rows.
create function public.prepare_collaboration_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  project public.projects%rowtype;
begin
  if auth.uid() is null or new.requester_id <> auth.uid() then
    raise exception 'Sign in to request collaboration.' using errcode = '42501';
  end if;
  select * into project from public.projects where id = new.project_id for update;
  if not found or not project.looking_for_collaborators then
    raise exception 'This project is no longer accepting requests.' using errcode = '22023';
  end if;
  if project.author_id = auth.uid() then
    raise exception 'You cannot request to join your own project.' using errcode = '22023';
  end if;
  new.owner_id := project.author_id;
  new.project_title := project.title;
  select coalesce(nullif(username, ''), 'Hobbyist') into new.requester_name
    from public.profiles where id = new.requester_id;
  select coalesce(nullif(username, ''), 'Hobbyist') into new.owner_name
    from public.profiles where id = new.owner_id;
  new.message := btrim(new.message);
  return new;
end;
$$;
revoke all on function public.prepare_collaboration_request() from public, anon, authenticated;
create trigger prepare_collaboration_request before insert on public.collaboration_requests
  for each row execute function public.prepare_collaboration_request();

-- SECURITY INVOKER preserves project visibility and table RLS. Retrying a
-- request returns the existing row instead of creating duplicates.
create function public.request_project_collaboration(p_project_id uuid, p_message text)
returns public.collaboration_requests
language plpgsql security invoker set search_path = '' as $$
declare result public.collaboration_requests;
begin
  if auth.uid() is null then
    raise exception 'Sign in to request collaboration.' using errcode = '42501';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 1000 then
    raise exception 'Write a message between 1 and 1,000 characters.' using errcode = '22023';
  end if;
  select * into result from public.collaboration_requests
    where project_id = p_project_id and requester_id = auth.uid();
  if found then return result; end if;
  insert into public.collaboration_requests(project_id, requester_id, message)
    values (p_project_id, auth.uid(), p_message)
    on conflict (project_id, requester_id) do nothing returning * into result;
  if result.id is null then
    select * into result from public.collaboration_requests
      where project_id = p_project_id and requester_id = auth.uid();
  end if;
  return result;
end;
$$;

create function public.respond_to_collaboration_request(p_request_id uuid, p_status text)
returns public.collaboration_requests
language plpgsql security definer set search_path = '' as $$
declare result public.collaboration_requests;
begin
  if auth.uid() is null then
    raise exception 'Sign in to respond.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('accepted', 'declined') then
    raise exception 'Choose accepted or declined.' using errcode = '22023';
  end if;
  select r.* into result from public.collaboration_requests r
    join public.projects p on p.id = r.project_id
    where r.id = p_request_id and r.owner_id = auth.uid() and p.author_id = auth.uid()
    for update of r;
  if not found then
    raise exception 'Request not found or you do not own this project.' using errcode = '42501';
  end if;
  if result.status = p_status then return result; end if;
  if result.status <> 'pending' then
    raise exception 'This request has already been answered.' using errcode = '22023';
  end if;
  update public.collaboration_requests set status = p_status, responded_at = now()
    where id = p_request_id returning * into result;
  return result;
end;
$$;

revoke all on function public.request_project_collaboration(uuid, text) from public, anon;
revoke all on function public.respond_to_collaboration_request(uuid, text) from public, anon;
grant execute on function public.request_project_collaboration(uuid, text) to authenticated;
grant execute on function public.respond_to_collaboration_request(uuid, text) to authenticated;

-- Supabase normally creates this publication already.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
alter publication supabase_realtime add table public.collaboration_requests;
notify pgrst, 'reload schema';
commit;
