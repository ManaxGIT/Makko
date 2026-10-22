-- All synthetic order/history/assignment rows are rolled back.
begin;
do $$
declare
  customer uuid; shopper uuid; outsider uuid; order_id uuid;
  changed public.shopping_requests; assignment public.request_assignments;
  history_count integer; photo_path text; result jsonb;
begin
  select id into customer from public.profiles order by id limit 1;
  select id into shopper from public.profiles where id <> customer order by id limit 1;
  select id into outsider from public.profiles where id not in (customer,shopper) order by id limit 1;
  if outsider is null then raise exception 'Test requires three profiles'; end if;
  insert into public.shopping_requests(customer_id,title,status,estimated_items_total,delivery_fee,
    delivery_recipient_name,delivery_phone,delivery_line1,delivery_city)
  values(customer,'Delivery confirmation test','delivering',100000,20000,
    'Test recipient','0900000000','Test address','Test city') returning id into order_id;
  insert into public.request_assignments(request_id,shopper_id) values(order_id,shopper);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.submit_delivery_evidence(order_id,'[]'::jsonb);
    raise exception 'FAIL anonymous submission';
  exception when insufficient_privilege then null; end;
  -- Customer cannot skip shopper confirmation or perform it for them.
  perform set_config('request.jwt.claim.sub',customer::text,true);
  begin
    perform public.submit_delivery_evidence(order_id,'[]'::jsonb);
    raise exception 'FAIL customer submitted handoff';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transition_request(order_id,'completed');
    raise exception 'FAIL customer skipped handoff';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  begin
    perform public.transition_request(order_id,'delivered');
    raise exception 'FAIL customer confirmed handoff';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.transition_request(order_id,'delivered');
    raise exception 'FAIL outsider confirmed handoff';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',shopper::text,true);
  begin
    perform public.transition_request(order_id,'completed');
    raise exception 'FAIL shopper skipped receipt';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;

  begin
    perform public.transition_request(order_id,'delivered');
    raise exception 'FAIL status-only bypass';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  begin
    perform public.submit_delivery_evidence(order_id,'[]'::jsonb);
    raise exception 'FAIL missing delivery photo';
  exception when raise_exception then if sqlerrm <> 'delivery_photo_required' then raise; end if; end;
  photo_path := shopper::text||'/'||order_id::text||'/delivery-test.jpg';
  begin
    perform public.submit_delivery_evidence(order_id,jsonb_build_array(jsonb_build_object('kind','delivery','storage_path',photo_path)));
    raise exception 'FAIL nonexistent Storage object';
  exception when raise_exception then if sqlerrm <> 'invalid_evidence' then raise; end if; end;
  -- Synthetic object metadata only; no file is uploaded and all rows roll back.
  insert into storage.objects(bucket_id,name,owner_id) values('purchase-evidence',photo_path,shopper::text);
  begin
    perform public.submit_delivery_evidence(order_id,jsonb_build_array(jsonb_build_object('kind','goods','storage_path',photo_path)));
    raise exception 'FAIL purchase photo used for delivery';
  exception when raise_exception then if sqlerrm <> 'invalid_evidence' then raise; end if; end;
  begin
    perform public.submit_delivery_evidence(order_id,jsonb_build_array(
      jsonb_build_object('kind','delivery','storage_path',photo_path),
      jsonb_build_object('kind','delivery','storage_path',photo_path||'.missing')));
    raise exception 'FAIL invalid batch committed';
  exception when raise_exception then if sqlerrm <> 'invalid_evidence' then raise; end if; end;
  if exists(select 1 from public.purchase_evidence where request_id=order_id) then raise exception 'FAIL partial registration'; end if;
  if (select status from public.shopping_requests where id=order_id)<>'delivering' then raise exception 'FAIL failed upload advanced status'; end if;
  result := public.submit_delivery_evidence(order_id,jsonb_build_array(jsonb_build_object('kind','delivery','storage_path',photo_path)));
  if result->>'status'<>'delivered' then raise exception 'FAIL handoff RPC'; end if;
  perform public.submit_delivery_evidence(order_id,jsonb_build_array(jsonb_build_object('kind','delivery','storage_path',photo_path)));
  if (select count(*) from public.purchase_evidence where request_id=order_id)<>1 then raise exception 'FAIL duplicate photo after retry'; end if;
  select * into changed from public.shopping_requests where id=order_id;
  if changed.status <> 'delivered' or changed.completed_at is not null then raise exception 'FAIL handoff completed order'; end if;
  select * into assignment from public.request_assignments where request_id=order_id;
  if assignment.status <> 'active' or assignment.completed_at is not null then raise exception 'FAIL assignment completed early'; end if;
  begin
    perform public.transition_request(order_id,'completed');
    raise exception 'FAIL shopper confirmed receipt';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if exists(select 1 from storage.objects where bucket_id='purchase-evidence' and name=photo_path) then raise exception 'FAIL outsider sees delivery photo'; end if;
  begin
    perform public.transition_request(order_id,'completed');
    raise exception 'FAIL outsider confirmed receipt';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',customer::text,true);
  if not exists(select 1 from storage.objects where bucket_id='purchase-evidence' and name=photo_path) then raise exception 'FAIL customer cannot view delivery photo'; end if;
  changed := public.transition_request(order_id,'completed');
  if changed.status <> 'completed' or changed.completed_at is null then raise exception 'FAIL receipt did not complete'; end if;
  select * into assignment from public.request_assignments where request_id=order_id;
  if assignment.status <> 'completed' or assignment.completed_at is null then raise exception 'FAIL assignment not completed'; end if;
  select count(*) into history_count from public.request_status_history where request_id=order_id and
    ((to_status='delivered' and actor_id=shopper) or (to_status='completed' and actor_id=customer));
  if history_count <> 2 then raise exception 'FAIL confirmation history'; end if;
  begin
    perform public.transition_request(order_id,'completed');
    raise exception 'FAIL duplicate receipt';
  exception when raise_exception then if sqlerrm <> 'invalid_status_transition' then raise; end if; end;
  execute 'reset role';
end $$;
rollback;
