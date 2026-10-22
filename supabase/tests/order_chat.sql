-- Synthetic requests/messages only. All writes, including history deletion, roll back.
begin;
do $$
<<order_chat>>
declare
  customer uuid; shopper uuid; outsider uuid; request_id uuid; assignment_id uuid;
  new_assignment_id uuid; retry_key uuid := gen_random_uuid(); sent jsonb; replay jsonb;
begin
  select id into customer from public.profiles where account_status='active' order by id limit 1;
  select id into shopper from public.profiles where account_status='active' and id<>customer order by id limit 1;
  select id into outsider from public.profiles where account_status='active' and id not in (customer,shopper) order by id limit 1;
  if outsider is null then raise exception 'Test requires three active profiles'; end if;
  insert into public.shopping_requests(customer_id,title,status,estimated_items_total,delivery_fee,
    delivery_recipient_name,delivery_phone,delivery_line1,delivery_city)
  values(customer,'Chat test','open',100000,20000,'Test','0900000000','Test address','Test city')
    returning id into request_id;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.send_order_message(request_id,gen_random_uuid(),'Before acceptance',retry_key);
    raise exception 'FAIL chat before acceptance';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  perform public.accept_request(request_id);
  select id into assignment_id from public.request_assignments a where a.request_id=order_chat.request_id and released_at is null;
  sent := public.send_order_message(request_id,assignment_id,'Xin chào',retry_key);
  replay := public.send_order_message(request_id,assignment_id,'Xin chào',retry_key);
  if sent->>'id'<>replay->>'id' then raise exception 'FAIL duplicate retry'; end if;
  if (select count(*) from public.messages m where m.request_id=order_chat.request_id)<>1 then raise exception 'FAIL duplicate inserted'; end if;
  begin
    perform public.send_order_message(request_id,assignment_id,'Different body',retry_key);
    raise exception 'FAIL reused key with different content';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_order_message(request_id,assignment_id,E' \t\n ',gen_random_uuid());
    raise exception 'FAIL blank message';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.send_order_message(request_id,assignment_id,repeat('a',4001),gen_random_uuid());
    raise exception 'FAIL oversized message';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.messages(request_id,sender_id,body) values(request_id,shopper,'Bypass');
    raise exception 'FAIL direct insert bypass';
  exception when insufficient_privilege then null; end;
  if has_table_privilege('authenticated','public.messages','TRUNCATE') then raise exception 'FAIL truncate privilege'; end if;

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL outsider read'; end if;
  begin
    perform public.send_order_message(request_id,assignment_id,'Outsider',gen_random_uuid());
    raise exception 'FAIL outsider send';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.send_order_message(request_id,assignment_id,'Anonymous',gen_random_uuid());
    raise exception 'FAIL anonymous send';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub',customer::text,true);
  perform public.send_order_message(request_id,assignment_id,'Chào bạn',gen_random_uuid());
  if (select count(*) from public.messages m where m.request_id=order_chat.request_id)<>2 then raise exception 'FAIL customer read/send'; end if;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  perform public.release_accepted_request(request_id);
  execute 'reset role';
  if exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL history retained on release'; end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform public.accept_request(request_id);
  select id into new_assignment_id from public.request_assignments a where a.request_id=order_chat.request_id and released_at is null;
  if exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL new shopper sees old history'; end if;
  perform public.send_order_message(request_id,new_assignment_id,'New chat',gen_random_uuid());
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  if exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL former shopper reads new chat'; end if;
  begin
    perform public.send_order_message(request_id,assignment_id,'Stale shopper',gen_random_uuid());
    raise exception 'FAIL former shopper sends';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.send_order_message(request_id,assignment_id,'Stale customer composer',gen_random_uuid());
    raise exception 'FAIL stale assignment accepted';
  exception when insufficient_privilege then null; end;

  -- Test closed states without changing existing purchase/delivery invariants.
  execute 'reset role';
  update public.shopping_requests r set status='completed',completed_at=now() where r.id=request_id;
  update public.request_assignments a set status='completed',completed_at=now() where a.id=new_assignment_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',customer::text,true);
  if not exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL completed history inaccessible'; end if;
  begin
    perform public.send_order_message(request_id,new_assignment_id,'After completion',gen_random_uuid());
    raise exception 'FAIL send after completion';
  exception when raise_exception then if sqlerrm<>'chat_read_only' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if not exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL completed shopper history inaccessible'; end if;
  execute 'reset role';
  update public.shopping_requests r set status='cancelled',cancelled_at=now() where r.id=request_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.send_order_message(request_id,new_assignment_id,'After cancellation',gen_random_uuid());
    raise exception 'FAIL send after cancellation';
  exception when raise_exception then if sqlerrm<>'chat_read_only' then raise; end if; end;
  if not exists(select 1 from public.messages m where m.request_id=order_chat.request_id) then raise exception 'FAIL cancelled history inaccessible'; end if;
  execute 'reset role';
end $$;
rollback;
