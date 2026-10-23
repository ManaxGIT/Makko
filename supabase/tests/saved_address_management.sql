-- Synthetic accounts, addresses and order are rolled back; no existing user data is edited.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  body jsonb; first_address jsonb; second_address jsonb; result jsonb;
  first_id uuid; second_id uuid; order_id uuid; ward_code text; province_code text;
begin
  insert into auth.users(id, raw_user_meta_data) values
    (owner_id, '{"display_name":"Address test owner"}'),
    (other_id, '{"display_name":"Address test other"}');
  select w.code,w.province_code into ward_code,province_code from public.wards w order by code limit 1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  body := jsonb_build_object('label','Nhà','recipient_name','Test recipient','recipient_phone','0901234567',
    'line1','Address snapshot before edit','province_code',province_code,'ward_code',ward_code,'is_default',false);
  first_address := public.create_delivery_address(body);
  first_id := (first_address->>'id')::uuid;
  if not (first_address->>'is_default')::boolean then raise exception 'First address must be default'; end if;
  if first_address->>'latitude' is not null then raise exception 'Coordinates fabricated'; end if;
  second_address := public.create_delivery_address(body || '{"label":"Công ty"}');
  second_id := (second_address->>'id')::uuid;
  if (second_address->>'is_default')::boolean then raise exception 'Later address changed default'; end if;
  result := public.create_and_publish_request(jsonb_build_object('submission_key','address-test-'||owner_id::text,
    'address_id',first_id,'items',jsonb_build_array(jsonb_build_object('name','Rau','quantity',1,'unit','bó','allow_substitution',false)),
    'estimated_items_total',50000,'delivery_fee',25000,'payment_method','cash','deliver_by',now()+interval '2 hours'));
  order_id := (result->>'request_id')::uuid;
  if order_id is null then raise exception 'Test order missing'; end if;
  perform public.update_delivery_address(first_id,body || '{"line1":"Edited address"}');
  if (select delivery_line1 from public.shopping_requests where id=order_id) <> 'Address snapshot before edit' then
    raise exception 'Editing changed order snapshot'; end if;
  if not (select is_default from public.addresses where id=first_id) then raise exception 'Editing silently unset default'; end if;
  begin
    perform public.update_delivery_address(first_id,body || '{"longitude":1}');
    raise exception 'Single coordinate accepted';
  exception when sqlstate '22023' then null; end;
  perform public.set_default_delivery_address(second_id);
  if (select count(*) from public.addresses a where a.owner_id=auth.uid() and is_default) <> 1 then
    raise exception 'Invalid default count'; end if;
  begin
    perform public.delete_delivery_address(second_id);
    raise exception 'Default deleted without replacement';
  exception when sqlstate '22023' then null; end;
  if not exists(select 1 from public.addresses where id=second_id and is_default) then raise exception 'Failed deletion changed default'; end if;
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  begin
    perform public.update_delivery_address(first_id,body);
    raise exception 'Other owner update accepted';
  exception when no_data_found then null; end;
  begin
    perform public.set_default_delivery_address(first_id);
    raise exception 'Other owner default accepted';
  exception when no_data_found then null; end;
  begin
    perform public.delete_delivery_address(first_id);
    raise exception 'Other owner deletion accepted';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.delete_delivery_address(second_id,first_id);
  if not (select is_default from public.addresses where id=first_id) then raise exception 'Replacement not default'; end if;
  result := public.delete_delivery_address(first_id);
  if result <> '[]'::jsonb then raise exception 'Last address not deleted'; end if;
  if (select delivery_line1 from public.shopping_requests where id=order_id) <> 'Address snapshot before edit'
    or (select source_address_id from public.shopping_requests where id=order_id) is not null then
    raise exception 'Deletion changed order snapshot'; end if;
  execute 'reset role';
end;
$$;
do $$
begin
  if has_function_privilege('anon','public.update_delivery_address(uuid,jsonb)','execute')
    or has_function_privilege('anon','public.set_default_delivery_address(uuid)','execute')
    or has_function_privilege('anon','public.delete_delivery_address(uuid,uuid)','execute') then
    raise exception 'Anonymous execution granted'; end if;
end;
$$;
rollback;
select 'Saved address management passed; all test writes rolled back' as result;
