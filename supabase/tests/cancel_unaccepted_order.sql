-- Existing transition and acceptance RPCs; all synthetic data rolls back.
begin;
do $$
declare owner_id uuid; shopper_id uuid; target_id uuid; changed public.shopping_requests;
begin
  select id into owner_id from public.profiles where account_status='active' order by id limit 1;
  select id into shopper_id from public.profiles where account_status='active' and id<>owner_id order by id limit 1;
  if shopper_id is null then raise exception 'Requires two active profiles'; end if;
  insert into public.shopping_requests(customer_id,title,status,estimated_items_total,delivery_fee,
    delivery_recipient_name,delivery_phone,delivery_line1,delivery_city)
  values(owner_id,'Cancellation test','open',100000,20000,'Test','0900000000','Test','Test') returning id into target_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',shopper_id::text,true);
  begin
    perform public.transition_request(target_id,'cancelled');
    raise exception 'FAIL non-owner cancelled';
  exception when raise_exception then if sqlerrm<>'invalid_status_transition' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  changed:=public.transition_request(target_id,'cancelled');
  if changed.status<>'cancelled' or changed.cancelled_at is null then raise exception 'FAIL cancellation'; end if;
  perform set_config('request.jwt.claim.sub',shopper_id::text,true);
  begin
    perform public.accept_request(target_id);
    raise exception 'FAIL accepted cancelled order';
  exception when raise_exception then if sqlerrm<>'request_not_available' then raise; end if; end;
  execute 'reset role';
  insert into public.shopping_requests(customer_id,title,status,estimated_items_total,delivery_fee,
    delivery_recipient_name,delivery_phone,delivery_line1,delivery_city)
  values(owner_id,'Acceptance wins test','open',100000,20000,'Test','0900000000','Test','Test') returning id into target_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',shopper_id::text,true);
  perform public.accept_request(target_id);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin
    perform public.transition_request(target_id,'cancelled');
    raise exception 'FAIL cancelled accepted order';
  exception when raise_exception then if sqlerrm<>'invalid_status_transition' then raise; end if; end;
  execute 'reset role';
end $$;
rollback;
