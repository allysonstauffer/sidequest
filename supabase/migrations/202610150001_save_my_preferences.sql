-- Requires the existing profiles and user_hobbies tables and their owner-write
-- RLS policies. Applies no changes to the team's public-read policies.
begin;

create or replace function public.save_my_preferences(p_preferences jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in before saving preferences.' using errcode = '42501';
  end if;

  if p_preferences is null or jsonb_typeof(p_preferences) <> 'array' then
    raise exception 'Preferences must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_preferences) not between 1 and 3 then
    raise exception 'Select between one and three hobbies.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_preferences) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
       or jsonb_typeof(item.value->'hobby') is distinct from 'string'
       or jsonb_typeof(item.value->'experience_level') is distinct from 'string'
       or coalesce(item.value->>'hobby', '') not in
          ('photography', 'gardening', 'cooking')
       or coalesce(item.value->>'experience_level', '') not in
          ('Beginner', 'Intermediate', 'Advanced', 'Expert')
  ) then
    raise exception 'Invalid hobby or experience level.' using errcode = '22023';
  end if;
  if (select count(distinct (item.value->>'hobby'))
      from jsonb_array_elements(p_preferences) as item(value))
      <> jsonb_array_length(p_preferences) then
    raise exception 'Select each hobby only once.' using errcode = '22023';
  end if;

  insert into public.profiles (id) values (current_user_id)
    on conflict (id) do nothing;

  -- A profile lock makes simultaneous saves replace whole selections in order.
  perform 1 from public.profiles where id = current_user_id for update;
  if not found then
    raise exception 'Profile is not accessible.' using errcode = '42501';
  end if;

  delete from public.user_hobbies where user_id = current_user_id;
  insert into public.user_hobbies (user_id, hobby, experience_level)
    select current_user_id, item.value->>'hobby', item.value->>'experience_level'
    from jsonb_array_elements(p_preferences) as item(value);

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_user_id;
  if not found then
    raise exception 'Profile cannot be updated.' using errcode = '42501';
  end if;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.user_hobbies to authenticated;

-- Handles an identity/serial column without assuming its sequence name.
do $$
declare
  sequence_name text := pg_get_serial_sequence('public.user_hobbies', 'id');
begin
  if sequence_name is not null then
    execute format('grant usage on sequence %s to authenticated', sequence_name);
  end if;
end;
$$;

revoke all on function public.save_my_preferences(jsonb) from public, anon;
grant execute on function public.save_my_preferences(jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
