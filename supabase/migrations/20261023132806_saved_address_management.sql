-- Serialize address management with creation and request publication via the owner profile lock.
create or replace function public.create_delivery_address(p_address jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_province text;
  v_ward text;
  v_lat double precision;
  v_lng double precision;
  v_default boolean;
  v_result public.addresses;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Serialize saves for one owner, including simultaneous default-address changes.
  perform id from public.profiles where id = v_user and account_status = 'active' for update;
  if not found then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  select p.full_name, w.full_name into v_province, v_ward
    from public.provinces p join public.wards w on w.province_code = p.code
    where p.code = p_address->>'province_code' and w.code = p_address->>'ward_code';
  if not found then
    raise exception 'Invalid delivery address' using errcode = '22023';
  end if;
  begin
    v_lat := (p_address->>'latitude')::double precision;
    v_lng := (p_address->>'longitude')::double precision;
    v_default := coalesce((p_address->>'is_default')::boolean, false);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Invalid delivery address' using errcode = '22023';
  end;
  if (v_lat is null) <> (v_lng is null)
     or (v_lat is not null and not (v_lat between -90 and 90))
     or (v_lng is not null and not (v_lng between -180 and 180))
     or coalesce(length(btrim(p_address->>'label')), 0) not between 1 and 60
     or coalesce(length(btrim(p_address->>'recipient_name')), 0) not between 1 and 160
     or coalesce(p_address->>'recipient_phone', '') !~ '^\+?[0-9][0-9 ()-]{7,19}$'
     or length(regexp_replace(coalesce(p_address->>'recipient_phone', ''), '[^0-9]', '', 'g')) not between 8 and 15
     or coalesce(length(btrim(p_address->>'line1')), 0) not between 1 and 300
     or length(p_address->>'line2') > 300
     or length(p_address->>'delivery_note') > 500 then
    raise exception 'Invalid delivery address' using errcode = '22023';
  end if;
  v_default := v_default or not exists(select 1 from public.addresses where owner_id=v_user);
  if v_default then
    update public.addresses set is_default = false where owner_id = v_user and is_default;
  end if;
  insert into public.addresses (
    owner_id, label, recipient_name, recipient_phone, line1, line2,
    province_code, ward_code, city, district, ward, latitude, longitude,
    delivery_note, is_default
  ) values (
    v_user, btrim(p_address->>'label'), btrim(p_address->>'recipient_name'),
    btrim(p_address->>'recipient_phone'), btrim(p_address->>'line1'),
    nullif(btrim(p_address->>'line2'), ''), p_address->>'province_code',
    p_address->>'ward_code', v_province, null, v_ward, v_lat, v_lng,
    nullif(btrim(p_address->>'delivery_note'), ''), v_default
  ) returning * into v_result;
  return to_jsonb(v_result);
end;
$$;
revoke all on function public.create_delivery_address(jsonb) from public, anon;
grant execute on function public.create_delivery_address(jsonb) to authenticated;

create function public.update_delivery_address(p_address_id uuid, p_address jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_existing public.addresses;
  v_province text; v_ward text;
  v_lat double precision; v_lng double precision; v_default boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform id from public.profiles where id=v_user and account_status='active' for update;
  if not found then raise exception 'Active profile required' using errcode='42501'; end if;
  select * into v_existing from public.addresses where id=p_address_id and owner_id=v_user for update;
  if not found then raise exception 'Address not found' using errcode='P0002'; end if;
  select p.full_name, w.full_name into v_province, v_ward
    from public.provinces p join public.wards w on w.province_code = p.code
    where p.code = p_address->>'province_code' and w.code = p_address->>'ward_code';
  if not found then
    raise exception 'Invalid delivery address' using errcode = '22023';
  end if;
  begin
    v_lat := (p_address->>'latitude')::double precision;
    v_lng := (p_address->>'longitude')::double precision;
    v_default := coalesce((p_address->>'is_default')::boolean, false);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Invalid delivery address' using errcode = '22023';
  end;
  if (v_lat is null) <> (v_lng is null)
     or (v_lat is not null and not (v_lat between -90 and 90))
     or (v_lng is not null and not (v_lng between -180 and 180))
     or coalesce(length(btrim(p_address->>'label')), 0) not between 1 and 60
     or coalesce(length(btrim(p_address->>'recipient_name')), 0) not between 1 and 160
     or coalesce(p_address->>'recipient_phone', '') !~ '^\+?[0-9][0-9 ()-]{7,19}$'
     or length(regexp_replace(coalesce(p_address->>'recipient_phone', ''), '[^0-9]', '', 'g')) not between 8 and 15
     or coalesce(length(btrim(p_address->>'line1')), 0) not between 1 and 300
     or length(p_address->>'line2') > 300
     or length(p_address->>'delivery_note') > 500 then
    raise exception 'Invalid delivery address' using errcode = '22023';
  end if;

  -- A default is replaced explicitly, never silently unset by editing its fields.
  v_default := v_default or v_existing.is_default;
  if v_default then
    update public.addresses set is_default=false where owner_id=v_user and is_default and id<>p_address_id;
  end if;
  update public.addresses set
    label=btrim(p_address->>'label'), recipient_name=btrim(p_address->>'recipient_name'),
    recipient_phone=btrim(p_address->>'recipient_phone'), line1=btrim(p_address->>'line1'),
    line2=nullif(btrim(p_address->>'line2'), ''), province_code=p_address->>'province_code',
    ward_code=p_address->>'ward_code', city=v_province, district=null, ward=v_ward,
    latitude=v_lat, longitude=v_lng, delivery_note=nullif(btrim(p_address->>'delivery_note'), ''),
    is_default=v_default
    where id=p_address_id and owner_id=v_user;
  return coalesce((select jsonb_agg(to_jsonb(a) order by is_default desc, created_at desc, id)
    from public.addresses a where owner_id=v_user), '[]'::jsonb);
end;
$$;

create function public.set_default_delivery_address(p_address_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform id from public.profiles where id=v_user and account_status='active' for update;
  if not found then raise exception 'Active profile required' using errcode='42501'; end if;
  perform id from public.addresses where id=p_address_id and owner_id=v_user for update;
  if not found then raise exception 'Address not found' using errcode='P0002'; end if;
  update public.addresses set is_default=false where owner_id=v_user and is_default and id<>p_address_id;
  update public.addresses set is_default=true where owner_id=v_user and id=p_address_id and not is_default;
  return coalesce((select jsonb_agg(to_jsonb(a) order by is_default desc, created_at desc, id)
    from public.addresses a where owner_id=v_user), '[]'::jsonb);
end;
$$;

create function public.delete_delivery_address(p_address_id uuid, p_replacement_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_existing public.addresses;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform id from public.profiles where id=v_user and account_status='active' for update;
  if not found then raise exception 'Active profile required' using errcode='42501'; end if;
  select * into v_existing from public.addresses where id=p_address_id and owner_id=v_user for update;
  if not found then raise exception 'Address not found' using errcode='P0002'; end if;
  if v_existing.is_default and exists(select 1 from public.addresses where owner_id=v_user and id<>p_address_id) then
    perform id from public.addresses where owner_id=v_user and id=p_replacement_id and id<>p_address_id for update;
    if not found then raise exception 'Default replacement required' using errcode='22023'; end if;
    update public.addresses set is_default=false where owner_id=v_user and id=p_address_id;
    update public.addresses set is_default=true where owner_id=v_user and id=p_replacement_id;
  end if;
  -- ON DELETE SET NULL only clears source_address_id; order delivery snapshots remain intact.
  delete from public.addresses where id=p_address_id and owner_id=v_user;
  return coalesce((select jsonb_agg(to_jsonb(a) order by is_default desc, created_at desc, id)
    from public.addresses a where owner_id=v_user), '[]'::jsonb);
end;
$$;
revoke all on function public.update_delivery_address(uuid,jsonb), public.set_default_delivery_address(uuid), public.delete_delivery_address(uuid,uuid) from public, anon;
grant execute on function public.update_delivery_address(uuid,jsonb), public.set_default_delivery_address(uuid), public.delete_delivery_address(uuid,uuid) to authenticated;
