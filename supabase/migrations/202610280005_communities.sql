begin;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 100),
  description text not null default ''
    check (char_length(description) <= 1000),
  hobby text not null
    check (hobby in ('photography', 'gardening', 'cooking')),
  created_at timestamptz not null default now()
);

create index if not exists communities_created_at_idx
  on public.communities (created_at desc);

alter table public.communities enable row level security;

grant select on public.communities to anon, authenticated;
grant insert on public.communities to authenticated;

drop policy if exists "Anyone can view communities"
  on public.communities;
create policy "Anyone can view communities"
  on public.communities for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create communities"
  on public.communities;
create policy "Users can create communities"
  on public.communities for insert
  to authenticated
  with check (creator_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
