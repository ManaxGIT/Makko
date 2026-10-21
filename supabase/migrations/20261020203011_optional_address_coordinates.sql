-- Saving an account address no longer requires coordinates.
-- Shopping-request coordinate constraints intentionally remain unchanged.
alter table public.addresses
  alter column latitude drop not null,
  alter column longitude drop not null,
  add constraint addresses_coordinate_pair_check
    check ((latitude is null) = (longitude is null));

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
