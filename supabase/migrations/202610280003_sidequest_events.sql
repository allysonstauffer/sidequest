begin;

create table if not exists public.sidequests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null check (char_length(btrim(location)) between 1 and 300),
  hobby text not null check (hobby in ('photography', 'gardening', 'cooking')),
  skill_level text not null check (
    skill_level in ('Beginner', 'Intermediate', 'Advanced', 'Expert')
  ),
  created_at timestamptz not null default now(),
  constraint sidequests_end_after_start check (ends_at > starts_at)
);

create index if not exists sidequests_upcoming_idx
  on public.sidequests (starts_at);

alter table public.sidequests enable row level security;

grant select on public.sidequests to anon, authenticated;
grant insert, update, delete on public.sidequests to authenticated;

drop policy if exists "Anyone can view sidequests"
  on public.sidequests;
create policy "Anyone can view sidequests"
  on public.sidequests for select
  to anon, authenticated
  using (true);

drop policy if exists "Hosts can create future sidequests"
  on public.sidequests;
create policy "Hosts can create future sidequests"
  on public.sidequests for insert
  to authenticated
  with check (host_id = (select auth.uid()) and starts_at > now());

drop policy if exists "Hosts can update their sidequests"
  on public.sidequests;
create policy "Hosts can update their sidequests"
  on public.sidequests for update
  to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

drop policy if exists "Hosts can delete their sidequests"
  on public.sidequests;
create policy "Hosts can delete their sidequests"
  on public.sidequests for delete
  to authenticated
  using (host_id = (select auth.uid()));

create table if not exists public.sidequest_rsvps (
  sidequest_id uuid not null
    references public.sidequests(id) on delete cascade,
  attendee_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sidequest_id, attendee_id)
);

alter table public.sidequest_rsvps enable row level security;

grant select, insert, delete on public.sidequest_rsvps to authenticated;

drop policy if exists "Users can view their own sidequest RSVPs"
  on public.sidequest_rsvps;
create policy "Users can view their own sidequest RSVPs"
  on public.sidequest_rsvps for select
  to authenticated
  using (attendee_id = (select auth.uid()));

drop policy if exists "Users can RSVP to future sidequests"
  on public.sidequest_rsvps;
create policy "Users can RSVP to future sidequests"
  on public.sidequest_rsvps for insert
  to authenticated
  with check (
    attendee_id = (select auth.uid())
    and exists (
      select 1
      from public.sidequests
      where id = sidequest_id and starts_at > now()
    )
  );

drop policy if exists "Users can cancel their own RSVPs"
  on public.sidequest_rsvps;
create policy "Users can cancel their own RSVPs"
  on public.sidequest_rsvps for delete
  to authenticated
  using (attendee_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
