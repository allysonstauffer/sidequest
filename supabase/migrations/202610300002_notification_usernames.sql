-- Signup, onboarding, and settings store the username in auth metadata.
-- Keep this lookup private: clients must not gain access to auth.users.
begin;

create function public.notification_actor_name(p_actor_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select nullif(btrim(u.raw_user_meta_data->>'display_name'), '')
      from auth.users u
      where u.id = p_actor_id
        and jsonb_typeof(u.raw_user_meta_data->'display_name') = 'string'),
    (select nullif(btrim(p.username), '') from public.profiles p where p.id = p_actor_id),
    'A hobbyist'
  );
$$;
revoke all on function public.notification_actor_name(uuid) from public, anon, authenticated;

create or replace function public.notify_project_like()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, actor_id, project_id, like_id, actor_name, project_title)
      select p.author_id, new.user_id, p.id, new.id,
        public.notification_actor_name(new.user_id), p.title
      from public.projects p
      where p.id = new.project_id and p.author_id <> new.user_id;
    return new;
  end if;
  update public.notifications set dismissed_at = now()
    where like_id = old.id and dismissed_at is null;
  return old;
end;
$$;
revoke all on function public.notify_project_like() from public, anon, authenticated;

create or replace function public.notify_user_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, actor_id, type, actor_name)
      select new.followed_id, new.follower_id, 'user_follow',
        public.notification_actor_name(new.follower_id)
      from public.profiles actor
      join public.profiles recipient on recipient.id = new.followed_id
      where actor.id = new.follower_id;
    return new;
  end if;
  update public.notifications set dismissed_at = now()
    where type = 'user_follow' and recipient_id = old.followed_id
      and actor_id = old.follower_id and dismissed_at is null;
  return old;
end;
$$;
revoke all on function public.notify_user_follow() from public, anon, authenticated;

-- Repair existing placeholders while preserving real historical name snapshots.
update public.notifications n
  set actor_name = public.notification_actor_name(n.actor_id)
  where btrim(n.actor_name) in ('', 'A hobbyist')
    and n.actor_name is distinct from public.notification_actor_name(n.actor_id);

notify pgrst, 'reload schema';
commit;
