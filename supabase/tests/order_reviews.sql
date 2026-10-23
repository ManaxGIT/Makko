-- Uses synthetic orders and rolls back every row and rating aggregate.
begin;
do $$
declare
  customer uuid; shopper uuid; outsider uuid; former uuid; order_id uuid; result jsonb; again jsonb;
  before_count bigint; before_sum numeric; after_profile public.profiles;
begin
  select id into customer from public.profiles where account_status='active' order by id limit 1;
  select id into shopper from public.profiles where account_status='active' and id<>customer order by id limit 1;
  select id into outsider from public.profiles where account_status='active' and id not in(customer,shopper) order by id limit 1;
  if outsider is null then raise exception 'Requires three active profiles'; end if;
  select count(*),coalesce(sum(rating),0) into before_count,before_sum from public.reviews where reviewee_id=shopper;
  insert into public.shopping_requests(customer_id,title,status,estimated_items_total,delivery_fee,delivery_recipient_name,delivery_phone,delivery_line1,delivery_city)
    values(customer,'Review test','delivered',100000,20000,'Test','0900000000','Test','Test') returning id into order_id;
  insert into public.request_assignments(request_id,shopper_id) values(order_id,outsider) returning id into former;
  update public.request_assignments set released_at=now(),status='released' where id=former;
  insert into public.request_assignments(request_id,shopper_id) values(order_id,shopper);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.submit_order_review(order_id,5,null);
    raise exception 'FAIL rated before receipt';
  exception when raise_exception then if sqlerrm<>'review_not_completed' then raise; end if; end;
  execute 'reset role';
  update public.shopping_requests set status='completed',completed_at=now() where id=order_id;
  update public.request_assignments set status='completed',completed_at=now() where request_id=order_id and released_at is null;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.submit_order_review(order_id,5,null);
    raise exception 'FAIL former shopper rated';
  exception when insufficient_privilege then if sqlerrm<>'review_not_found' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.submit_order_review(order_id,6,null);
    raise exception 'FAIL invalid rating';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.submit_order_review(order_id,5,repeat('x',1001));
    raise exception 'FAIL long comment';
  exception when invalid_parameter_value then null; end;
  result := public.submit_order_review(order_id,4,' Tốt ');
  again := public.submit_order_review(order_id,4,'Tốt');
  if result->>'id'<>again->>'id' then raise exception 'FAIL retry duplicated'; end if;
  begin
    perform public.submit_order_review(order_id,5,null);
    raise exception 'FAIL edited review';
  exception when raise_exception then if sqlerrm<>'review_already_submitted' then raise; end if; end;
  begin
    insert into public.reviews(request_id,reviewer_id,reviewee_id,rating) values(order_id,customer,shopper,5);
    raise exception 'FAIL direct insert';
  exception when insufficient_privilege then null; end;
  begin
    update public.reviews set rating=1 where id=(result->>'id')::uuid;
    raise exception 'FAIL direct update';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.reviews where id=(result->>'id')::uuid;
    raise exception 'FAIL direct delete';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  perform public.submit_order_review(order_id,5,null);
  execute 'reset role';
  select * into after_profile from public.profiles where id=shopper;
  if after_profile.rating_count<>before_count+1 or after_profile.average_rating<>round((before_sum+4)/(before_count+1),2) then raise exception 'FAIL aggregate'; end if;
  if (select count(*) from public.reviews where request_id=order_id)<>2 then raise exception 'FAIL two-way reviews'; end if;
end $$;
rollback;
