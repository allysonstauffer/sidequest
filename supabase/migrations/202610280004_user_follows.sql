begin;

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_not_self check (follower_id <> followed_id),
  primary key (follower_id, followed_id)
);

create index if not exists user_follows_followed_idx
  on public.user_follows (followed_id);

alter table public.user_follows enable row level security;

grant select, insert, delete on public.user_follows to authenticated;

drop policy if exists "Users can view their follows"
  on public.user_follows;
create policy "Users can view their follows"
  on public.user_follows for select
  to authenticated
  using (follower_id = (select auth.uid()));

drop policy if exists "Users can follow other users"
  on public.user_follows;
create policy "Users can follow other users"
  on public.user_follows for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and followed_id <> (select auth.uid())
  );

drop policy if exists "Users can unfollow users"
  on public.user_follows;
create policy "Users can unfollow users"
  on public.user_follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
