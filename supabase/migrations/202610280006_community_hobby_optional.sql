begin;

alter table public.communities
  alter column hobby drop not null;

notify pgrst, 'reload schema';

commit;
