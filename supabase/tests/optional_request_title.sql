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
  body := body || '{"title":"  Trái cây cho cả nhà  "}'::jsonb;
  result := public.create_and_publish_request(body);
  select * into order_row from public.shopping_requests where id=(result->>'request_id')::uuid;
  if order_row.title<>'Trái cây cho cả nhà' then raise exception 'Custom creation title lost'; end if;
  body := body || jsonb_build_object('address_id',null,'expected_updated_at',order_row.updated_at,
    'submission_key','test-title-edit-0001','title','Trứng và sữa cho bữa sáng');
  perform public.update_shopping_request(order_row.id,body);
  if (select title from public.shopping_requests where id=order_row.id)<>'Trứng và sữa cho bữa sáng'
    then raise exception 'Custom edit title lost'; end if;
  body := (body - 'title') || '{"submission_key":"test-title-edit-0002"}'::jsonb;
  perform public.update_shopping_request(order_row.id,body);
  if (select title from public.shopping_requests where id=order_row.id)<>'Trứng và sữa cho bữa sáng'
    then raise exception 'Older client overwrote title'; end if;
  body := body || '{"submission_key":"test-title-edit-0003","title":"   "}'::jsonb;
  perform public.update_shopping_request(order_row.id,body);
  if (select title from public.shopping_requests where id=order_row.id)<>'Đi chợ: Rau muống, Chuối'
    then raise exception 'Clearing title did not regenerate'; end if;
  begin
    perform public.update_shopping_request(order_row.id,body || '{"submission_key":"test-title-edit-0004","title":"ab"}'::jsonb);
    raise exception 'Short title accepted';
  exception when sqlstate '22023' then null; end;
  if (select title from public.shopping_requests where id=order_row.id)<>'Đi chợ: Rau muống, Chuối'
    then raise exception 'Invalid edit changed title'; end if;
  body := body || jsonb_build_object('address_id',a->>'id','submission_key','test-title-create-0002');
  result := public.create_and_publish_request(body);
  if (select title from public.shopping_requests where id=(result->>'request_id')::uuid)<>'Đi chợ: Rau muống, Chuối'
    then raise exception 'Blank creation title did not generate'; end if;
  begin
    perform public.create_and_publish_request(body || jsonb_build_object('submission_key','test-title-create-0003','title',repeat('x',121)));
    raise exception 'Long title accepted';
  exception when sqlstate '22023' then null; end;
end;
$$;
reset role;
rollback;
select 'Title checks passed: custom create/edit, trimming, blank fallback, old client preservation and invalid lengths' as result;
