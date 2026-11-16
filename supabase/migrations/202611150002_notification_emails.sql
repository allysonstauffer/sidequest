-- Queue new inbox notifications in the same transaction as the event.
-- Delivery RPCs are restricted to the backend service role.
begin;

create table public.notification_email_outbox (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  last_error text
);
create index notification_email_pending
  on public.notification_email_outbox(available_at, notification_id)
  where status in ('pending', 'processing');
alter table public.notification_email_outbox enable row level security;
revoke all on public.notification_email_outbox from public, anon, authenticated;
grant select on public.notifications to service_role;
grant select on public.notification_email_outbox to service_role;
create policy notification_email_service_read on public.notification_email_outbox
  for select to service_role using (true);

create function public.queue_notification_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dismissed_at is null then
    insert into public.notification_email_outbox(notification_id) values (new.id)
      on conflict (notification_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_notification_email() from public, anon, authenticated;
create trigger queue_notification_email after insert on public.notifications
  for each row execute function public.queue_notification_email();

create function public.claim_notification_email()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  job public.notification_email_outbox%rowtype;
  payload jsonb;
begin
  -- Resolve the current verified account email only on the server. Never copy
  -- addresses into browser-readable notifications or accept one from a caller.
  update public.notification_email_outbox o
    set status = 'cancelled', locked_at = null, lease_token = null,
      last_error = 'notification_or_recipient_unavailable'
    where (o.status = 'pending' or (o.status = 'processing'
      and o.locked_at < clock_timestamp() - interval '5 minutes'))
    and not exists (
      select 1 from public.notifications n join auth.users u on u.id = n.recipient_id
      where n.id = o.notification_id and n.dismissed_at is null
        and u.email_confirmed_at is not null and nullif(btrim(u.email), '') is not null
    );

  -- A worker that repeatedly crashes must not retry a job forever.
  update public.notification_email_outbox
    set status = 'failed', locked_at = null, lease_token = null,
      last_error = 'attempt_limit_reached'
    where attempts >= 8 and (status = 'pending' or (status = 'processing'
      and locked_at < clock_timestamp() - interval '5 minutes'));

  select * into job from public.notification_email_outbox
    where attempts < 8 and ((status = 'pending' and available_at <= clock_timestamp())
      or (status = 'processing' and locked_at < clock_timestamp() - interval '5 minutes'))
    order by available_at, notification_id
    limit 1 for update skip locked;
  if not found then return null; end if;

  update public.notification_email_outbox
    set status = 'processing', attempts = attempts + 1,
      locked_at = clock_timestamp(), lease_token = gen_random_uuid()
    where notification_id = job.notification_id returning * into job;

  select jsonb_build_object(
    'notification_id', n.id, 'lease_token', job.lease_token,
    'recipient_email', u.email, 'type', n.type,
    'actor_id', n.actor_id, 'actor_name', n.actor_name,
    'project_id', n.project_id, 'project_title', n.project_title,
    'created_at', n.created_at
  ) into payload
  from public.notifications n join auth.users u on u.id = n.recipient_id
  where n.id = job.notification_id;
  return payload;
end;
$$;

create function public.finish_notification_email(
  p_notification_id uuid, p_lease_token uuid, p_sent boolean
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if p_sent is null then
    raise exception 'A delivery result is required.' using errcode = '22023';
  end if;
  update public.notification_email_outbox
    set status = case when p_sent then 'sent' when attempts >= 8 then 'failed' else 'pending' end,
      sent_at = case when p_sent then clock_timestamp() else null end,
      available_at = case when p_sent then available_at
        else clock_timestamp() + make_interval(secs => least(3600, 30 * power(2, attempts - 1))::integer) end,
      locked_at = null, lease_token = null,
      last_error = case when p_sent then null else 'smtp_delivery_failed' end
    where notification_id = p_notification_id and status = 'processing'
      and lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_notification_email() from public, anon, authenticated;
revoke all on function public.finish_notification_email(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_notification_email() to service_role;
grant execute on function public.finish_notification_email(uuid, uuid, boolean) to service_role;
-- Reuse the inbox's publication. This also supports installations where it
-- has not yet been enabled for notifications.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
