-- Requires user_follows and project_likes_notifications migrations.
begin;

alter table public.notifications
  alter column project_id drop not null,
  alter column like_id drop not null,
  alter column project_title drop not null,
  drop constraint notifications_type_check,
  add constraint notifications_type_check check (type in ('project_like', 'user_follow')),
  add constraint notifications_event_fields_check check (
    (type = 'project_like' and project_id is not null and like_id is not null and project_title is not null)
    or (type = 'user_follow' and project_id is null and like_id is null and project_title is null)
  );

create unique index notifications_active_follow
  on public.notifications(recipient_id, actor_id)
  where type = 'user_follow' and dismissed_at is null;

create function public.notify_user_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, actor_id, type, actor_name)
      select new.followed_id, new.follower_id, 'user_follow',
        coalesce(nullif(actor.username, ''), 'A hobbyist')
      from public.profiles actor
      join public.profiles recipient on recipient.id = new.followed_id
      where actor.id = new.follower_id;
    return new;
  end if;
  -- Retain the row so authorized Realtime UPDATEs remove the alert and badge.
  update public.notifications set dismissed_at = now()
    where type = 'user_follow' and recipient_id = old.followed_id
      and actor_id = old.follower_id and dismissed_at is null;
  return old;
end;
$$;
revoke all on function public.notify_user_follow() from public, anon, authenticated;
create trigger user_follow_notification after insert or delete on public.user_follows
  for each row execute function public.notify_user_follow();

notify pgrst, 'reload schema';
commit;
