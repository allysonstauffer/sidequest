begin;

alter table public.projects
  add column if not exists hobby text,
  add column if not exists skill_level text,
  add column if not exists author_display_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_hobby_allowed'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_hobby_allowed
      check (hobby is null or hobby in ('photography', 'gardening', 'cooking'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_skill_level_allowed'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_skill_level_allowed
      check (
        skill_level is null
        or skill_level in ('Beginner', 'Intermediate', 'Advanced', 'Expert')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_author_display_name_length'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_author_display_name_length
      check (
        author_display_name is null
        or char_length(author_display_name) between 1 and 80
      );
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
