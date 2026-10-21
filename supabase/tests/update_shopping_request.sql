-- All writes are rolled back. Requires an active profile and another owner's address.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where account_status='active' order by id limit 1),true);
select set_config('makko.test_other_address',(select id::text from public.addresses where owner_id<>auth.uid() limit 1),true);
set local role authenticated;
do $$
declare
  a jsonb;
  body jsonb;
  result jsonb;
  repeated jsonb;
  before_count bigint;
  original_items jsonb;
  original_order jsonb;
  order_row public.shopping_requests;
  item_row public.request_items;
begin
  a := public.create_delivery_address(jsonb_build_object(
    'label','Test','recipient_name','Test','recipient_phone','0901234567','line1','Test only',
    'province_code','79','ward_code','26740','is_default',false
  ));
  body := jsonb_build_object(
    'submission_key','test-publish-transaction-0001','address_id',a->>'id',
    'deliver_by',now()+interval '1 day','delivery_fee',25000,'estimated_items_total',null,
    'payment_method','bank_transfer','delivery_note','Call on arrival',
    'items',jsonb_build_array(
      jsonb_build_object('name','Rau muống','quantity',0.5,'unit','bó','note','Rau non','allow_substitution',true),
      jsonb_build_object('name','Chuối','quantity',1,'unit','nải','allow_substitution',false)
    )
  );
  result := public.create_and_publish_request(body);
  select * into order_row from public.shopping_requests where id=(result->>'request_id')::uuid;
  select * into item_row from public.request_items where request_id=order_row.id and sort_order=0;
  update public.request_items set estimated_unit_price=12345 where id=item_row.id;
  body := body || jsonb_build_object('address_id',null,'expected_updated_at',order_row.updated_at,
    'submission_key','test-edit-transaction-0001','delivery_fee',30000,'payment_method','cash',
    'items',jsonb_build_array(
      jsonb_build_object('id',item_row.id,'name','Rau cải','quantity',2,'unit','mớ','allow_substitution',false),
      jsonb_build_object('name','Cam','quantity',3,'unit','quả','allow_substitution',true)));
  update public.addresses set line1='Changed saved address' where id=(a->>'id')::uuid;
  result := public.update_shopping_request(order_row.id,body);
  if result->>'status'<>'open' then raise exception 'Changed status'; end if;
  if (select delivery_line1 from public.shopping_requests where id=order_row.id)<>'Test only'
    then raise exception 'Snapshot unexpectedly changed'; end if;
  if not exists(select 1 from public.request_items where id=item_row.id and name='Rau cải' and quantity=2 and unit='mớ' and estimated_unit_price=12345)
    then raise exception 'Retained item or metadata lost'; end if;
  if (select count(*) from public.request_items where request_id=order_row.id)<>2
    or exists(select 1 from public.request_items where request_id=order_row.id and name='Chuối')
    then raise exception 'Replacement failed'; end if;
  select to_jsonb(r) into original_order from public.shopping_requests r where id=order_row.id;
  select jsonb_agg(to_jsonb(i) order by sort_order) into original_items from public.request_items i where request_id=order_row.id;
  repeated := public.update_shopping_request(order_row.id,body);
  if repeated<>result then raise exception 'Replay failed'; end if;
  if (select jsonb_agg(to_jsonb(i) order by sort_order) from public.request_items i where request_id=order_row.id)<>original_items
    then raise exception 'Replay replaced items'; end if;
  body := body || jsonb_build_object('submission_key','test-edit-transaction-0002');
  begin
    perform public.update_shopping_request(order_row.id,body || jsonb_build_object('expected_updated_at',now()-interval '1 day'));
    raise exception 'Stale edit accepted';
  exception when sqlstate '22023' then if sqlerrm<>'request_changed' then raise; end if; end;
  begin
    perform public.update_shopping_request(order_row.id,jsonb_set(body,'{items,1,allow_substitution}','"invalid"'));
    raise exception 'Invalid item accepted';
  exception when sqlstate '22023' then null; end;
  if (select to_jsonb(r) from public.shopping_requests r where id=order_row.id)<>original_order
    or (select jsonb_agg(to_jsonb(i) order by sort_order) from public.request_items i where request_id=order_row.id)<>original_items
    then raise exception 'Partial update persisted'; end if;
  begin
    perform public.update_shopping_request(order_row.id,body || jsonb_build_object('address_id',current_setting('makko.test_other_address')));
    raise exception 'Other address accepted';
  exception when sqlstate '22023' then if sqlerrm<>'address_not_found' then raise; end if; end;
  result := public.update_shopping_request(order_row.id,body || jsonb_build_object('address_id',a->>'id'));
  if (select delivery_line1 from public.shopping_requests where id=order_row.id)<>'Changed saved address'
    then raise exception 'Address replacement failed'; end if;
  perform set_config('makko.test_order',order_row.id::text,true);
  perform set_config('makko.test_body',body::text,true);
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',(select owner_id::text from public.addresses where id=current_setting('makko.test_other_address')::uuid),true);
set local role authenticated;
do $$ begin
  begin
    perform public.update_shopping_request(current_setting('makko.test_order')::uuid,current_setting('makko.test_body')::jsonb);
    raise exception 'Other owner edited request';
  exception when sqlstate '22023' then if sqlerrm<>'request_not_found' then raise; end if; end;
  perform public.accept_request(current_setting('makko.test_order')::uuid);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select customer_id::text from public.shopping_requests where id=current_setting('makko.test_order')::uuid),true);
set local role authenticated;
do $$ begin
  if public.update_shopping_request(current_setting('makko.test_order')::uuid,current_setting('makko.test_body')::jsonb)->>'status'<>'accepted' then
    raise exception 'Replay after acceptance failed';
  end if;
  begin
    perform public.update_shopping_request(current_setting('makko.test_order')::uuid,
      current_setting('makko.test_body')::jsonb || '{"submission_key":"test-edit-after-accept-0003"}'::jsonb);
    raise exception 'Accepted request edited';
  exception when sqlstate '22023' then
    if sqlerrm not in ('request_not_editable','request_not_found') then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.update_shopping_request(uuid,jsonb)','EXECUTE') then raise exception 'Anonymous execution allowed'; end if;
end $$;
rollback;
select 'Edit checks passed: items, metadata, snapshot, address replacement, rollback, replay, conflicts, ownership and accepted status' as result;
