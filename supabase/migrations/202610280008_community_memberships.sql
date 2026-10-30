begin;

create table if not exists public.community_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

create index if not exists community_memberships_community_id_idx
  on public.community_memberships (community_id);

alter table public.community_memberships enable row level security;

grant select, insert, delete on public.community_memberships
  to authenticated;

drop policy if exists "Users can view their community memberships"
  on public.community_memberships;
create policy "Users can view their community memberships"
  on public.community_memberships for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can join communities"
  on public.community_memberships;
create policy "Users can join communities"
  on public.community_memberships for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can leave communities"
  on public.community_memberships;
create policy "Users can leave communities"
  on public.community_memberships for delete
  to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
