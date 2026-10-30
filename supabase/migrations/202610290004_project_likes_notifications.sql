-- Apply once. Requires existing projects and profiles; preserves their policies.
begin;

create table public.project_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_likes_user on public.project_likes(user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Kept as an event ID after unlike so its UPDATE can remove it from live UI.
  like_id uuid not null unique,
  type text not null default 'project_like' check (type = 'project_like'),
  actor_name text not null,
  project_title text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  check (recipient_id <> actor_id)
);
create index notifications_recipient_created on public.notifications(recipient_id, created_at desc)
  where dismissed_at is null;
create index notifications_unread on public.notifications(recipient_id)
  where read_at is null and dismissed_at is null;
create index notifications_project on public.notifications(project_id);
create index notifications_actor on public.notifications(actor_id);

alter table public.project_likes enable row level security;
alter table public.notifications enable row level security;
revoke all on public.project_likes, public.notifications from public, anon, authenticated;
grant select, delete on public.project_likes to authenticated;
grant insert(project_id, user_id) on public.project_likes to authenticated;
grant select on public.notifications to authenticated;

create policy likes_read_visible_projects on public.project_likes for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
create policy likes_insert_self on public.project_likes for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id));
create policy likes_delete_self on public.project_likes for delete to authenticated
  using (user_id = (select auth.uid()));
-- Keep dismissed rows readable by the recipient so Realtime UPDATE delivery
-- still works. UI queries exclude them. No client can insert/modify alerts.
create policy notifications_read_recipient on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

create function public.notify_project_like()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, actor_id, project_id, like_id, actor_name, project_title)
      select p.author_id, new.user_id, p.id, new.id,
        coalesce(nullif(u.username, ''), 'A hobbyist'), p.title
      from public.projects p join public.profiles u on u.id = new.user_id
      where p.id = new.project_id and p.author_id <> new.user_id;
    return new;
  end if;
  update public.notifications set dismissed_at = now()
    where like_id = old.id and dismissed_at is null;
  return old;
end;
$$;
revoke all on function public.notify_project_like() from public, anon, authenticated;
create trigger project_like_notification after insert or delete on public.project_likes
  for each row execute function public.notify_project_like();

-- Batch aggregation avoids downloading all likes or making one call per card.
create function public.get_project_like_summaries(p_project_ids uuid[])
returns table(project_id uuid, like_count bigint, liked boolean)
language sql stable security invoker set search_path = '' as $$
  select p.id, count(l.id), coalesce(bool_or(l.user_id = auth.uid()), false)
  from public.projects p left join public.project_likes l on l.project_id = p.id
  where p.id = any(p_project_ids)
  group by p.id;
$$;

create function public.set_project_like(p_project_id uuid, p_liked boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to like a project.' using errcode = '42501';
  end if;
  if p_liked is null then
    raise exception 'Choose like or unlike.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'This project is unavailable.' using errcode = '42501';
  end if;
  if p_liked then
    insert into public.project_likes(project_id, user_id) values (p_project_id, auth.uid())
      on conflict (project_id, user_id) do nothing;
  else
    delete from public.project_likes where project_id = p_project_id and user_id = auth.uid();
  end if;
  select to_jsonb(s) into result from public.get_project_like_summaries(array[p_project_id]) s;
  return result;
end;
$$;

create function public.mark_notifications_read(p_notification_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to read notifications.' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
    where recipient_id = auth.uid() and dismissed_at is null and read_at is null
      and (p_notification_id is null or id = p_notification_id);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.get_project_like_summaries(uuid[]) from public, anon;
revoke all on function public.set_project_like(uuid, boolean) from public, anon;
revoke all on function public.mark_notifications_read(uuid) from public, anon;
grant execute on function public.get_project_like_summaries(uuid[]) to authenticated;
grant execute on function public.set_project_like(uuid, boolean) to authenticated;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
alter publication supabase_realtime add table public.notifications;
notify pgrst, 'reload schema';
commit;
