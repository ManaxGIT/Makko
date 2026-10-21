-- Run against a migrated database with at least one active profile.
-- Every write (including default changes) is rolled back.
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where account_status='active' order by id limit 1), true);
set local role authenticated;
do $$
declare
  v_body jsonb;
  v_first jsonb;
  v_second jsonb;
  v_count bigint;
  v_ward text;
  v_province text;
begin
  if auth.uid() is null then raise exception 'Test requires an active profile'; end if;
  select code, province_code into v_ward, v_province from public.wards order by code limit 1;
  v_body := jsonb_build_object(
    'label', 'API transaction test', 'recipient_name', 'Test recipient',
    'recipient_phone', '0901234567', 'line1', 'Test only, rolled back',
    'province_code', v_province, 'ward_code', v_ward,
    'latitude', 21.03, 'longitude', 105.85, 'is_default', true,
    'owner_id', '00000000-0000-0000-0000-000000000001'
  );
  v_first := public.create_delivery_address(v_body);
  if (v_first->>'owner_id')::uuid <> auth.uid() then raise exception 'Owner spoofing'; end if;
  if v_first->>'city' <> (select full_name from public.provinces where code=v_province)
    then raise exception 'Incorrect canonical province'; end if;
  v_second := public.create_delivery_address(v_body);
  select count(*) into v_count from public.addresses where owner_id=auth.uid() and is_default;
  if v_count <> 1 then raise exception 'Multiple default addresses'; end if;
  if (select is_default from public.addresses where id=(v_first->>'id')::uuid)
    then raise exception 'Previous default still selected'; end if;
  if not (select is_default from public.addresses where id=(v_second->>'id')::uuid)
    then raise exception 'New default not selected'; end if;

  -- Both omitted is now valid, while a single coordinate remains invalid.
  v_second := public.create_delivery_address(v_body - 'latitude' - 'longitude');
  if v_second->>'latitude' is not null or v_second->>'longitude' is not null then
    raise exception 'Missing coordinates were fabricated';
  end if;
  if not exists(select 1 from public.addresses where id=(v_second->>'id')::uuid and latitude is null and longitude is null) then
    raise exception 'Address without coordinates not persisted';
  end if;
  begin
    perform public.create_delivery_address(v_body - 'latitude');
    raise exception 'Missing latitude accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_delivery_address(v_body || '{"longitude":181}'::jsonb);
    raise exception 'Out-of-range longitude accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_delivery_address(v_body || jsonb_build_object('latitude','NaN'));
    raise exception 'NaN accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_delivery_address(v_body || '{"province_code":"00"}'::jsonb);
    raise exception 'Unknown province accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_delivery_address(v_body || jsonb_build_object('province_code',
      (select code from public.provinces where code<>v_province limit 1)));
    raise exception 'Mismatched province/ward accepted';
  exception when sqlstate '22023' then null; end;
  if exists(select 1 from public.addresses where owner_id<>auth.uid())
    then raise exception 'Other owner addresses visible'; end if;
  begin
    update public.addresses set owner_id='00000000-0000-0000-0000-000000000001'
      where id=(v_second->>'id')::uuid;
    raise exception 'Address owner reassignment accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.provinces set name='Tampered' where code=v_province;
    raise exception 'Directory mutation accepted';
  exception when insufficient_privilege then null; end;
  if not (select is_default from public.addresses where id=(v_second->>'id')::uuid)
    then raise exception 'Invalid save changed default'; end if;
end;
$$;
reset role;
do $$
begin
  if has_function_privilege('anon','public.create_delivery_address(jsonb)','EXECUTE') then
    raise exception 'Anonymous RPC execution allowed';
  end if;
end;
$$;
rollback;
select 'Delivery address database checks passed; all test writes rolled back' as result;
