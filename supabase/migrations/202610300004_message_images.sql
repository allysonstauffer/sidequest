begin;

alter table public.messages add column image_path text;
grant select(image_path), insert(image_path) on public.messages to authenticated;
create unique index messages_image_path on public.messages(image_path) where image_path is not null;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('dm-images', 'dm-images', false, 10485760, array['image/jpeg','image/png','image/webp']);

-- Restrictive guards also protect this bucket when older buckets have broad
-- permissive policies. They leave access to every other bucket unchanged.
create policy dm_images_access on storage.objects for all to authenticated
  using (bucket_id = 'dm-images') with check (bucket_id = 'dm-images');

create policy dm_images_upload on storage.objects as restrictive for insert to public
  with check (
    bucket_id <> 'dm-images' or (
    array_length(string_to_array(name, '/'), 1) = 3
    and split_part(name, '/', 2) = (select auth.uid())::text
    and split_part(name, '/', 3) ~ '^[a-f0-9-]+\.(jpg|png|webp)$'
    and exists (select 1 from public.room_participants p
      where p.room_id::text = split_part(name, '/', 1) and p.user_id = (select auth.uid())))
  );

create policy dm_images_read on storage.objects as restrictive for select to public
  using (
    bucket_id <> 'dm-images' or (
    exists (select 1 from public.room_participants p
      where p.room_id::text = split_part(name, '/', 1) and p.user_id = (select auth.uid()))
    and (split_part(name, '/', 2) = (select auth.uid())::text
      or exists (select 1 from public.messages m
        where m.image_path = name and m.room_id::text = split_part(name, '/', 1))))
  );

-- Only the uploader can clean up an unused upload. Sent photos cannot be
-- removed through this cleanup policy, including after an ambiguous save.
create policy dm_images_cleanup on storage.objects as restrictive for delete to public
  using (
    bucket_id <> 'dm-images' or (split_part(name, '/', 2) = (select auth.uid())::text
    and not exists (select 1 from public.messages m where m.image_path = name))
  );

create policy dm_images_immutable on storage.objects as restrictive for update to public
  using (bucket_id <> 'dm-images') with check (bucket_id <> 'dm-images');

create function public.validate_message_image()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.image_path is null then return new; end if;
  if auth.uid() is null or new.sender_id <> auth.uid()
    or split_part(new.image_path, '/', 1) <> new.room_id::text
    or split_part(new.image_path, '/', 2) <> new.sender_id::text
    or array_length(string_to_array(new.image_path, '/'), 1) <> 3
    or split_part(new.image_path, '/', 3) !~ '^[a-f0-9-]+\.(jpg|png|webp)$'
    or not exists (select 1 from public.room_participants p
      where p.room_id = new.room_id and p.user_id = auth.uid()) then
    raise exception 'You cannot attach this image to this conversation.' using errcode = '42501';
  end if;
  perform 1 from storage.objects o
    where o.bucket_id = 'dm-images' and o.name = new.image_path for key share;
  if not found then
    raise exception 'Upload the image before sending it.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_message_image() from public, anon, authenticated;
create trigger validate_message_image before insert or update on public.messages
  for each row execute function public.validate_message_image();

notify pgrst, 'reload schema';
commit;
