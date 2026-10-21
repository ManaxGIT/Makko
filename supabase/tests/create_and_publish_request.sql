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
  if order_row.status<>'open' or order_row.published_at is null or order_row.customer_id<>auth.uid()
    then raise exception 'Request not published correctly'; end if;
  if order_row.delivery_latitude is not null or order_row.delivery_longitude is not null
    then raise exception 'Missing coordinates fabricated'; end if;
  if order_row.delivery_phone <> '0901234567' or order_row.delivery_line1 <> 'Test only'
    or order_row.payment_method<>'bank_transfer' or order_row.delivery_fee<>25000
    or order_row.estimated_items_total is not null or order_row.delivery_note<>'Call on arrival'
    then raise exception 'Request snapshot mismatch'; end if;
  select * into item_row from public.request_items where request_id=order_row.id and sort_order=0;
  if item_row.quantity<>0.5 or item_row.unit<>'bó' or not item_row.allow_substitution
    then raise exception 'Item mismatch'; end if;
  if (select count(*) from public.request_items where request_id=order_row.id)<>2
    then raise exception 'Missing items'; end if;
  if not exists(select 1 from public.request_status_history where request_id=order_row.id and to_status='open')
    then raise exception 'Publication history missing'; end if;
  repeated := public.create_and_publish_request(body);
  if repeated->>'request_id'<>result->>'request_id' then raise exception 'Duplicate request'; end if;
  if (select count(*) from public.shopping_requests where customer_id=auth.uid() and submission_key=body->>'submission_key')<>1
    then raise exception 'Idempotency failed'; end if;

  -- Existing order keeps its address snapshot when saved address changes later.
  update public.addresses set line1='Changed address' where id=(a->>'id')::uuid;
  if (select delivery_line1 from public.shopping_requests where id=order_row.id)<>'Test only'
    then raise exception 'Order snapshot changed'; end if;
  body := body || '{"submission_key":"test-publish-invalid-0001"}'::jsonb;
  select count(*) into before_count from public.shopping_requests where customer_id=auth.uid();
  begin
    perform public.create_and_publish_request(body || '{"items":[]}'::jsonb);
    raise exception 'Empty list accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_and_publish_request(body || jsonb_build_object('deliver_by',now()-interval '1 hour'));
    raise exception 'Past delivery accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_and_publish_request(body || jsonb_build_object('address_id',current_setting('makko.test_other_address')));
    raise exception 'Other owner address accepted';
  exception when sqlstate '22023' then null; end;
  -- Bad boolean reaches item insertion after creating the draft: it must roll everything back.
  begin
    perform public.create_and_publish_request(jsonb_set(body,'{items,1,allow_substitution}','"invalid"'));
    raise exception 'Invalid item accepted';
  exception when sqlstate '22023' then null; end;
  if (select count(*) from public.shopping_requests where customer_id=auth.uid())<>before_count
    then raise exception 'Failed submission left an orphan draft'; end if;
end;
$$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.create_and_publish_request(jsonb)','EXECUTE') then
    raise exception 'Anonymous execution allowed';
  end if;
end $$;
rollback;
select 'Publication checks passed: open status, items, snapshot, ownership, retries and rollback' as result;
