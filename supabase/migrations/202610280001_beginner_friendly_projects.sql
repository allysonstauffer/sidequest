begin;

alter table public.projects
  add column if not exists beginner_friendly boolean not null default false;

notify pgrst, 'reload schema';

commit;
