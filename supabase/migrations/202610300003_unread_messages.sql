-- Uses the existing rooms, room_participants, and messages tables.
begin;

-- Infer the existing chat ID types rather than assuming UUID vs integer IDs.
create table public.message_receipts as
  select m.id as message_id, m.room_id, p.user_id as recipient_id,
    null::timestamptz as read_at
  from public.messages m join public.room_participants p on p.room_id = m.room_id
  with no data;
alter table public.message_receipts
  add column id bigint generated always as identity primary key,
  alter column message_id set not null,
  alter column room_id set not null,
  alter column recipient_id set not null,
  add unique (message_id, recipient_id),
  add foreign key (message_id) references public.messages(id) on delete cascade,
  add foreign key (room_id) references public.rooms(id) on delete cascade,
  add foreign key (recipient_id) references auth.users(id) on delete cascade;
create index message_receipts_unread on public.message_receipts(recipient_id, room_id, id)
  where read_at is null;
create index message_receipts_lookup on public.message_receipts(room_id, (message_id::text), id);
alter table public.message_receipts enable row level security;
revoke all on public.message_receipts from public, anon, authenticated;
grant select on public.message_receipts to authenticated;
create policy message_receipts_read_self on public.message_receipts for select to authenticated
  using (recipient_id = (select auth.uid()) and exists (
    select 1 from public.room_participants p
    where p.room_id = message_receipts.room_id and p.user_id = (select auth.uid())
  ));

create function public.create_message_receipts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.message_receipts(message_id, room_id, recipient_id)
    select new.id, new.room_id, p.user_id from public.room_participants p
    where p.room_id = new.room_id and p.user_id <> new.sender_id
    on conflict (message_id, recipient_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_message_receipts() from public, anon, authenticated;
create trigger message_unread_receipts after insert on public.messages
  for each row execute function public.create_message_receipts();

create function public.get_message_unread_counts()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(counts)), '[]'::jsonb)
  from (
    select r.room_id::text as room_id, count(*) as unread_count
    from public.message_receipts r where r.read_at is null
    group by r.room_id
  ) counts;
$$;

create function public.mark_room_messages_read(p_room_id text, p_message_ids text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare cutoff bigint; changed integer; target_room public.rooms.id%type;
begin
  if auth.uid() is null then
    raise exception 'Sign in to read messages.' using errcode = '42501';
  end if;
  select p.room_id into target_room from public.room_participants p
    where p.room_id::text = p_room_id and p.user_id = auth.uid();
  if not found then
    raise exception 'This conversation is unavailable.' using errcode = '42501';
  end if;
  -- Use receipts for loaded messages (including the viewer's replies) as a
  -- boundary. Only the caller's older unread receipts are acknowledged below.
  -- Receipts arriving later remain unread, even with equal timestamps.
  select max(r.id) into cutoff from public.message_receipts r
    where r.room_id = target_room
      and r.message_id::text = any(p_message_ids);
  update public.message_receipts r set read_at = now()
    where r.recipient_id = auth.uid() and r.room_id = target_room
      and r.read_at is null and r.id <= cutoff;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.get_message_unread_counts() from public, anon;
revoke all on function public.mark_room_messages_read(text, text[]) from public, anon;
grant execute on function public.get_message_unread_counts() to authenticated;
grant execute on function public.mark_room_messages_read(text, text[]) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
alter publication supabase_realtime add table public.message_receipts;
notify pgrst, 'reload schema';
commit;
