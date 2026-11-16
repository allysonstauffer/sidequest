-- Requires the existing chat, unread-receipt, and message-image migrations.
begin;

alter table public.messages add column unsent_at timestamptz;
grant select(unsent_at) on public.messages to authenticated;
alter table public.messages enable row level security;

-- Legacy permissive policies must not allow clients to rewrite timestamps,
-- restore content, or hard-delete the notice. Only the guarded RPC can update.
create policy messages_update_via_rpc on public.messages
  as restrictive for update to authenticated, anon using (false) with check (false);
create policy messages_keep_unsent_notice on public.messages
  as restrictive for delete to authenticated, anon using (false);

create function public.stamp_new_message()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := clock_timestamp();
  new.unsent_at := null;
  return new;
end;
$$;
revoke all on function public.stamp_new_message() from public, anon, authenticated;
create trigger stamp_new_message before insert on public.messages
  for each row execute function public.stamp_new_message();

create function public.unsend_message(p_message_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.messages%rowtype;
  current_time_value timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in before unsending a message.' using errcode = '42501';
  end if;

  -- Lock before checking the deadline so concurrent retries cannot extend it.
  select m.* into target from public.messages m
    where m.id::text = p_message_id and m.sender_id = auth.uid()
      and exists (select 1 from public.room_participants p
        where p.room_id = m.room_id and p.user_id = auth.uid())
    for update;
  if not found then
    raise exception 'This message is unavailable or is not yours.' using errcode = '42501';
  end if;

  -- A lost response can be safely retried even after the deadline.
  if target.unsent_at is null then
    current_time_value := clock_timestamp();
    if target.created_at is null or target.created_at > current_time_value
      or current_time_value >= target.created_at + interval '2 minutes' then
      raise exception 'Messages can only be unsent within 2 minutes of sending.' using errcode = '22023';
    end if;

    update public.messages
      set text = 'Message unsent', image_path = null, unsent_at = current_time_value
      where id = target.id returning * into target;

    -- Preserve receipt boundaries but remove unread counts for removed content.
    update public.message_receipts set read_at = current_time_value
      where message_id = target.id and read_at is null;
  end if;

  return jsonb_build_object(
    'id', target.id::text, 'room_id', target.room_id::text,
    'sender_id', target.sender_id, 'text', target.text,
    'image_path', target.image_path, 'created_at', target.created_at,
    'unsent_at', target.unsent_at
  );
end;
$$;
revoke all on function public.unsend_message(text) from public, anon;
grant execute on function public.unsend_message(text) to authenticated;

-- Publish updates for open conversations, including installations where the
-- existing messages table was not already added to Realtime.
do $$
begin
  if not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
