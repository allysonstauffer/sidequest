begin;

create table if not exists public.hobby_categories (
  id text primary key
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 60),
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  creator_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists hobby_categories_name_lower_idx
  on public.hobby_categories (lower(name));

insert into public.hobby_categories (id, name)
values
  ('photography', 'Photography'),
  ('gardening', 'Gardening'),
  ('cooking', 'Cooking')
on conflict (id) do nothing;

alter table public.hobby_categories enable row level security;
grant select on public.hobby_categories to anon, authenticated;
grant insert on public.hobby_categories to authenticated;

drop policy if exists "Anyone can view hobby categories"
  on public.hobby_categories;
create policy "Anyone can view hobby categories"
  on public.hobby_categories for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create hobby categories"
  on public.hobby_categories;
create policy "Users can create hobby categories"
  on public.hobby_categories for insert
  to authenticated
  with check (creator_id = (select auth.uid()));

-- Replace hobby allowlists with references to the shared category catalog.
do $$
declare
  target record;
  existing_check record;
begin
  for target in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'hobby'
      and table_name in (
        'user_hobbies',
        'projects',
        'sidequests',
        'communities'
      )
  loop
    for existing_check in
      select constraint_row.conname
      from pg_constraint constraint_row
      join pg_class relation
        on relation.oid = constraint_row.conrelid
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where constraint_row.contype = 'c'
        and namespace.nspname = target.table_schema
        and relation.relname = target.table_name
        and position(
          'hobby' in lower(pg_get_constraintdef(constraint_row.oid))
        ) > 0
    loop
      execute format(
        'alter table %I.%I drop constraint %I',
        target.table_schema,
        target.table_name,
        existing_check.conname
      );
    end loop;

    if not exists (
      select 1
      from pg_constraint constraint_row
      join pg_class relation
        on relation.oid = constraint_row.conrelid
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where constraint_row.contype = 'f'
        and namespace.nspname = target.table_schema
        and relation.relname = target.table_name
        and constraint_row.conname =
          target.table_name || '_hobby_category_fkey'
    ) then
      execute format(
        'alter table %I.%I add constraint %I foreign key (hobby) references public.hobby_categories(id)',
        target.table_schema,
        target.table_name,
        target.table_name || '_hobby_category_fkey'
      );
    end if;
  end loop;
end;
$$;

create or replace function public.save_my_preferences(p_preferences jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in before saving preferences.' using errcode = '42501';
  end if;

  if p_preferences is null or jsonb_typeof(p_preferences) <> 'array' then
    raise exception 'Preferences must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_preferences) not between 1 and 3 then
    raise exception 'Select between one and three hobbies.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_preferences) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
       or jsonb_typeof(item.value->'hobby') is distinct from 'string'
       or jsonb_typeof(item.value->'experience_level') is distinct from 'string'
       or not exists (
         select 1
         from public.hobby_categories category
         where category.id = item.value->>'hobby'
       )
       or coalesce(item.value->>'experience_level', '') not in
          ('Beginner', 'Intermediate', 'Advanced', 'Expert')
  ) then
    raise exception 'Invalid hobby or experience level.' using errcode = '22023';
  end if;
  if (
    select count(distinct (item.value->>'hobby'))
    from jsonb_array_elements(p_preferences) as item(value)
  ) <> jsonb_array_length(p_preferences) then
    raise exception 'Select each hobby only once.' using errcode = '22023';
  end if;

  insert into public.profiles (id) values (current_user_id)
    on conflict (id) do nothing;

  perform 1 from public.profiles where id = current_user_id for update;
  if not found then
    raise exception 'Profile is not accessible.' using errcode = '42501';
  end if;

  delete from public.user_hobbies where user_id = current_user_id;
  insert into public.user_hobbies (user_id, hobby, experience_level)
    select
      current_user_id,
      item.value->>'hobby',
      item.value->>'experience_level'
    from jsonb_array_elements(p_preferences) as item(value);

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_user_id;
  if not found then
    raise exception 'Profile cannot be updated.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.save_my_preferences(jsonb) from public, anon;
grant execute on function public.save_my_preferences(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
