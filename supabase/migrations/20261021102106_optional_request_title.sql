-- Optional user titles reuse the existing 3–120 character title column.

create or replace function public.create_and_publish_request(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_address public.addresses;
  v_order public.shopping_requests;
  v_key text := p_request->>'submission_key';
  v_item jsonb;
  v_position bigint;
  v_quantity numeric;
  v_fee numeric;
  v_budget numeric;
  v_deliver_by timestamptz;
  v_title text;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if v_key is null or v_key !~ '^[a-zA-Z0-9_-]{16,100}$' then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  -- Serializes concurrent submissions/retries from this account.
  perform id from public.profiles where id=v_user and account_status='active' for update;
  if not found then raise exception 'active_profile_required' using errcode='42501'; end if;
  select * into v_order from public.shopping_requests
    where customer_id=v_user and submission_key=v_key;
  if found then
    return jsonb_build_object('request_id',v_order.id,'status',v_order.status);
  end if;

  select * into v_address from public.addresses
    where id=(p_request->>'address_id')::uuid and owner_id=v_user for share;
  if not found then raise exception 'address_not_found' using errcode='22023'; end if;
  v_deliver_by := (p_request->>'deliver_by')::timestamptz;
  if v_deliver_by is null or not isfinite(v_deliver_by) or v_deliver_by <= now() then
    raise exception 'delivery_time_must_be_future' using errcode='22023';
  end if;
  v_fee := (p_request->>'delivery_fee')::numeric;
  v_budget := (p_request->>'estimated_items_total')::numeric;
  if v_fee is null or v_fee < 0 or v_fee >= 10000000000 or trunc(v_fee,2) <> v_fee
    or (v_budget is not null and (v_budget < 0 or v_budget >= 10000000000 or trunc(v_budget,2) <> v_budget))
    or coalesce(p_request->>'payment_method','') not in ('cash','bank_transfer')
    or length(p_request->>'delivery_note') > 500 then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  if jsonb_typeof(p_request->'items') is distinct from 'array' then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  if jsonb_array_length(p_request->'items') not between 1 and 100 then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  -- Validate before inserting; any later error still rolls the entire RPC back.
  for v_item in select value from jsonb_array_elements(p_request->'items') loop
    v_quantity := (v_item->>'quantity')::numeric;
    if coalesce(length(btrim(v_item->>'name')),0) not between 1 and 160
      or coalesce(length(btrim(v_item->>'unit')),0) not between 1 and 30
      or v_quantity is null or v_quantity <= 0 or v_quantity >= 10000000
      or trunc(v_quantity,3) <> v_quantity or length(v_item->>'note') > 500 then
      raise exception 'invalid_request' using errcode='22023';
    end if;
  end loop;
  select left('Đi chợ: ' || string_agg(btrim(value->>'name'), ', ' order by ord),120)
    into v_title from jsonb_array_elements(p_request->'items') with ordinality as items(value,ord);

  if p_request ? 'title' then
    if jsonb_typeof(p_request->'title') not in ('string','null') then
      raise exception 'invalid_request' using errcode='22023';
    end if;
    v_title := coalesce(nullif(btrim(p_request->>'title'),''),v_title);
  end if;
  if char_length(v_title) not between 3 and 120 then
    raise exception 'invalid_request' using errcode='22023';
  end if;

  insert into public.shopping_requests (
    customer_id, source_address_id, submission_key, title, estimated_items_total,
    delivery_fee, deliver_by, payment_method, delivery_recipient_name, delivery_phone,
    delivery_line1, delivery_line2, delivery_ward, delivery_district, delivery_city,
    delivery_latitude, delivery_longitude, delivery_note
  ) values (
    v_user, v_address.id, v_key, v_title, v_budget, v_fee, v_deliver_by,
    (p_request->>'payment_method')::public.payment_method,
    v_address.recipient_name, v_address.recipient_phone, v_address.line1, v_address.line2,
    v_address.ward, v_address.district, v_address.city, v_address.latitude, v_address.longitude,
    nullif(btrim(p_request->>'delivery_note'),'')
  ) returning * into v_order;
  for v_item, v_position in select value,ord from jsonb_array_elements(p_request->'items') with ordinality as items(value,ord) loop
    insert into public.request_items(request_id,name,quantity,unit,note,allow_substitution,sort_order)
    values(v_order.id,btrim(v_item->>'name'),(v_item->>'quantity')::numeric,btrim(v_item->>'unit'),
      nullif(btrim(v_item->>'note'),''),coalesce((v_item->>'allow_substitution')::boolean,false),v_position-1);
  end loop;
  -- Reuse the established publishing transaction and its status/history triggers.
  v_order := public.publish_request(v_order.id);
  return jsonb_build_object('request_id',v_order.id,'status',v_order.status);
exception
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format
    or datetime_field_overflow or check_violation or not_null_violation then
    raise exception 'invalid_request' using errcode='22023';
end;
$$;
revoke all on function public.create_and_publish_request(jsonb) from public, anon;
grant execute on function public.create_and_publish_request(jsonb) to authenticated;

create or replace function public.update_shopping_request(target_request_id uuid, p_request jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_order public.shopping_requests;
  v_address public.addresses;
  v_key text := p_request->>'submission_key';
  v_item jsonb;
  v_old_items jsonb;
  v_old jsonb;
  v_position bigint;
  v_quantity numeric;
  v_fee numeric;
  v_budget numeric;
  v_deliver_by timestamptz;
  v_title text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if v_key is null or v_key !~ '^[a-zA-Z0-9_-]{16,100}$' then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  perform id from public.profiles where id=v_user and account_status='active' for update;
  if not found then raise exception 'active_profile_required' using errcode='42501'; end if;
  -- Read first so retries can acknowledge an edit even after the order is accepted.
  select * into v_order from public.shopping_requests
    where id=target_request_id and customer_id=v_user;
  if not found then raise exception 'request_not_found' using errcode='22023'; end if;
  if v_order.last_edit_key = v_key then
    return jsonb_build_object('request_id',v_order.id,'status',v_order.status);
  end if;
  if v_order.status not in ('draft','open') then
    raise exception 'request_not_editable' using errcode='22023';
  end if;
  -- Lock and recheck: accept_request acquires this same row lock.
  select * into v_order from public.shopping_requests
    where id=target_request_id and customer_id=v_user for update;
  if not found then raise exception 'request_not_editable' using errcode='22023'; end if;
  if v_order.last_edit_key = v_key then
    return jsonb_build_object('request_id',v_order.id,'status',v_order.status);
  end if;
  if v_order.status not in ('draft','open') then
    raise exception 'request_not_editable' using errcode='22023';
  end if;
  if v_order.updated_at is distinct from (p_request->>'expected_updated_at')::timestamptz then
    raise exception 'request_changed' using errcode='22023';
  end if;
  if p_request->>'address_id' is not null then
    select * into v_address from public.addresses
      where id=(p_request->>'address_id')::uuid and owner_id=v_user for share;
    if not found then raise exception 'address_not_found' using errcode='22023'; end if;
  end if;
  v_deliver_by := (p_request->>'deliver_by')::timestamptz;
  if v_deliver_by is null or not isfinite(v_deliver_by) or v_deliver_by <= now() then
    raise exception 'delivery_time_must_be_future' using errcode='22023';
  end if;
  v_fee := (p_request->>'delivery_fee')::numeric;
  v_budget := (p_request->>'estimated_items_total')::numeric;
  if v_fee is null or v_fee < 0 or v_fee >= 10000000000 or trunc(v_fee,2) <> v_fee
    or (v_budget is not null and (v_budget < 0 or v_budget >= 10000000000 or trunc(v_budget,2) <> v_budget))
    or coalesce(p_request->>'payment_method','') not in ('cash','bank_transfer')
    or length(p_request->>'delivery_note') > 500 then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  if jsonb_typeof(p_request->'items') is distinct from 'array' then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  if jsonb_array_length(p_request->'items') not between 1 and 100 then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  -- Validate before inserting; any later error still rolls the entire RPC back.
  for v_item in select value from jsonb_array_elements(p_request->'items') loop
    v_quantity := (v_item->>'quantity')::numeric;
    if coalesce(length(btrim(v_item->>'name')),0) not between 1 and 160
      or coalesce(length(btrim(v_item->>'unit')),0) not between 1 and 30
      or v_quantity is null or v_quantity <= 0 or v_quantity >= 10000000
      or trunc(v_quantity,3) <> v_quantity or length(v_item->>'note') > 500 then
      raise exception 'invalid_request' using errcode='22023';
    end if;
  end loop;
  select left('Đi chợ: ' || string_agg(btrim(value->>'name'), ', ' order by ord),120)
    into v_title from jsonb_array_elements(p_request->'items') with ordinality as items(value,ord);

  if p_request ? 'title' then
    if jsonb_typeof(p_request->'title') not in ('string','null') then
      raise exception 'invalid_request' using errcode='22023';
    end if;
    v_title := coalesce(nullif(btrim(p_request->>'title'),''),v_title);
  else
    -- Requests from older clients omit title; preserve existing names.
    v_title := v_order.title;
  end if;
  if char_length(v_title) not between 3 and 120 then
    raise exception 'invalid_request' using errcode='22023';
  end if;


  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_old_items
    from public.request_items i where request_id=v_order.id;
  for v_item in select value from jsonb_array_elements(p_request->'items') loop
    if v_item->>'id' is not null and not exists (
      select 1 from jsonb_array_elements(v_old_items) old where old->>'id'=v_item->>'id'
    ) then raise exception 'invalid_request' using errcode='22023'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_request->'items') i
    where i->>'id' is not null group by i->>'id' having count(*)>1) then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  update public.shopping_requests set
    title=v_title, estimated_items_total=v_budget, delivery_fee=v_fee, deliver_by=v_deliver_by,
    payment_method=(p_request->>'payment_method')::public.payment_method,
    delivery_note=nullif(btrim(p_request->>'delivery_note'),''), last_edit_key=v_key
    where id=v_order.id;
  if v_address.id is not null then
    update public.shopping_requests set source_address_id=v_address.id,
      delivery_recipient_name=v_address.recipient_name, delivery_phone=v_address.recipient_phone,
      delivery_line1=v_address.line1, delivery_line2=v_address.line2, delivery_ward=v_address.ward,
      delivery_district=v_address.district, delivery_city=v_address.city,
      delivery_latitude=v_address.latitude, delivery_longitude=v_address.longitude where id=v_order.id;
  end if;
  -- Replace the ordered collection atomically, retaining IDs and hidden metadata of retained items.
  delete from public.request_items where request_id=v_order.id;
  for v_item, v_position in select value,ord from jsonb_array_elements(p_request->'items') with ordinality as items(value,ord) loop
    select value into v_old from jsonb_array_elements(v_old_items) where value->>'id'=v_item->>'id';
    insert into public.request_items(id,request_id,name,quantity,unit,note,allow_substitution,sort_order,estimated_unit_price,created_at)
    values(coalesce((v_old->>'id')::uuid,gen_random_uuid()),v_order.id,btrim(v_item->>'name'),
      (v_item->>'quantity')::numeric,btrim(v_item->>'unit'),nullif(btrim(v_item->>'note'),''),
      coalesce((v_item->>'allow_substitution')::boolean,false),v_position-1,
      (v_old->>'estimated_unit_price')::numeric,coalesce((v_old->>'created_at')::timestamptz,now()));
  end loop;
  return jsonb_build_object('request_id',v_order.id,'status',v_order.status);
exception
  when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format
    or datetime_field_overflow or check_violation or not_null_violation then
    raise exception 'invalid_request' using errcode='22023';
end;
$$;
revoke all on function public.update_shopping_request(uuid,jsonb) from public, anon;
grant execute on function public.update_shopping_request(uuid,jsonb) to authenticated;
