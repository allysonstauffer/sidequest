-- Apply when project inserts fail with PostgreSQL permission error 42501.
-- Requires the existing projects table and RLS. Preserves existing read policies.
begin;

do $$
begin
  if not (select relrowsecurity from pg_class
          where oid = 'public.projects'::regclass) then
    raise exception 'projects RLS must already be enabled. Review existing visibility before enabling it.';
  end if;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, delete on public.projects to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'projects' and policyname = 'sidequest_projects_insert_own') then
    create policy sidequest_projects_insert_own on public.projects
      for insert to authenticated
      with check (author_id = (select auth.uid()));
  end if;

  -- INSERT ... RETURNING and the profile feed need owner read access.
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'projects' and policyname = 'sidequest_projects_select_own') then
    create policy sidequest_projects_select_own on public.projects
      for select to authenticated
      using (author_id = (select auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'projects' and policyname = 'sidequest_projects_delete_own') then
    create policy sidequest_projects_delete_own on public.projects
      for delete to authenticated
      using (author_id = (select auth.uid()));
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
