-- Synthetic orders only: all changes are rolled back.
begin;
do $$
declare customer uuid; shopper uuid; outsider uuid; order_id uuid; assignment uuid;
  result jsonb; proposal uuid; next_proposal uuid;
begin
  select id into customer from public.profiles where account_status='active' order by id limit 1;
  select id into shopper from public.profiles where account_status='active' and id<>customer order by id limit 1;
  select id into outsider from public.profiles where account_status='active' and id not in(customer,shopper) order by id limit 1;
  if outsider is null then raise exception 'Requires three active profiles'; end if;
  insert into public.shopping_requests(customer_id,title,status,estimated_items_total,delivery_fee,actual_items_total,delivery_recipient_name,delivery_phone,delivery_line1,delivery_city)
    values(customer,'Goods agreement test','open',180000,30000,170000,'Test','0900000000','Test','Test') returning id into order_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.propose_goods_amount(order_id,200000);
    raise exception 'FAIL proposal before acceptance';
  exception when raise_exception then if sqlerrm<>'agreement_stage_closed' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  perform public.accept_request(order_id);
  begin
    perform public.propose_goods_amount(order_id,200000);
    raise exception 'FAIL shopper proposed';
  exception when insufficient_privilege then if sqlerrm<>'agreement_not_found' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.propose_goods_amount(order_id,180000);
    raise exception 'FAIL identical amount';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.propose_goods_amount(order_id,0.001);
    raise exception 'FAIL rounded consent';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.propose_goods_amount(order_id,'NaN'::numeric);
    raise exception 'FAIL nonfinite consent';
  exception when invalid_parameter_value then null; end;
  result := public.propose_goods_amount(order_id,200000);
  proposal := (result->'proposal'->>'id')::uuid;
  if (result->>'agreed_amount')::numeric<>180000 or (result->>'delivery_fee')::numeric<>30000 then raise exception 'FAIL money changed without consent'; end if;
  if public.propose_goods_amount(order_id,200000)->'proposal'->>'id'<>proposal::text then raise exception 'FAIL duplicate retry'; end if;
  begin
    perform public.propose_goods_amount(order_id,220000);
    raise exception 'FAIL replaced pending consent';
  exception when raise_exception then if sqlerrm<>'agreement_pending' then raise; end if; end;
  begin
    perform public.respond_goods_amount(order_id,proposal,true);
    raise exception 'FAIL customer confirmed both sides';
  exception when insufficient_privilege then if sqlerrm<>'agreement_not_found' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.get_goods_amount_agreement(order_id);
    raise exception 'FAIL outsider read';
  exception when insufficient_privilege then if sqlerrm<>'agreement_not_found' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  perform public.transition_request(order_id,'shopping');
  result := public.get_goods_amount_agreement(order_id);
  if result->'proposal'->>'status'<>'pending' then raise exception 'FAIL start expired proposal'; end if;
  result := public.respond_goods_amount(order_id,proposal,true);
  if (result->>'agreed_amount')::numeric<>200000 or result->'proposal'->>'status'<>'accepted' then raise exception 'FAIL shopping approval'; end if;
  perform public.respond_goods_amount(order_id,proposal,true); -- lost response retry
  begin
    perform public.respond_goods_amount(order_id,proposal,false);
    raise exception 'FAIL reversed agreement';
  exception when raise_exception then if sqlerrm<>'agreement_already_resolved' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  result := public.propose_goods_amount(order_id,190000);
  next_proposal := (result->'proposal'->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  result := public.respond_goods_amount(order_id,next_proposal,false);
  if (result->>'agreed_amount')::numeric<>200000 then raise exception 'FAIL rejection changed amount'; end if;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  result := public.propose_goods_amount(order_id,210000);
  next_proposal := (result->'proposal'->>'id')::uuid;
  -- Simulate the end-of-shopping transaction (evidence registration tests cover its own gates).
  execute 'reset role';
  update public.shopping_requests set status='delivering' where id=order_id;
  if (select status from public.goods_amount_proposals where id=next_proposal)<>'expired' then raise exception 'FAIL delivery did not expire pending'; end if;
  if (select actual_items_total from public.shopping_requests where id=order_id)<>170000 or (select delivery_fee from public.shopping_requests where id=order_id)<>30000 then raise exception 'FAIL changed unrelated money'; end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  begin
    perform public.respond_goods_amount(order_id,next_proposal,true);
    raise exception 'FAIL late approval';
  exception when raise_exception then if sqlerrm<>'agreement_already_resolved' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.propose_goods_amount(order_id,210000);
    raise exception 'FAIL delivery proposal';
  exception when raise_exception then if sqlerrm<>'agreement_stage_closed' then raise; end if; end;
  begin
    update public.shopping_requests set estimated_items_total=1 where id=order_id;
    if found then raise exception 'FAIL direct money bypass'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.goods_amount_proposals(request_id,assignment_id,new_amount) values(order_id,gen_random_uuid(),1);
    raise exception 'FAIL direct proposal insert';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  -- Release and reassignment must never reuse the previous shopper's consent.
  update public.shopping_requests set status='accepted' where id=order_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',customer::text,true);
  result := public.propose_goods_amount(order_id,220000);
  proposal := (result->'proposal'->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  perform public.release_accepted_request(order_id);
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform public.accept_request(order_id);
  begin
    perform public.respond_goods_amount(order_id,proposal,true);
    raise exception 'FAIL new shopper reused consent';
  exception when insufficient_privilege then if sqlerrm<>'agreement_not_found' then raise; end if; end;
  result := public.get_goods_amount_agreement(order_id);
  if result->'proposal'<>'null'::jsonb then raise exception 'FAIL previous proposal exposed'; end if;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  begin
    perform public.respond_goods_amount(order_id,proposal,true);
    raise exception 'FAIL released shopper approved';
  exception when insufficient_privilege then if sqlerrm<>'agreement_not_found' then raise; end if; end;
  execute 'reset role';
end $$;
rollback;
