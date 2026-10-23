-- A private-to-owner, immutable snapshot; cancellation retains the order and recipe.
create table public.order_recipes (
 request_id uuid primary key references public.shopping_requests(id) on delete cascade,
 customer_id uuid not null references public.profiles(id),
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index order_recipes_customer_id_idx on public.order_recipes(customer_id);
alter table public.order_recipes enable row level security;
revoke all on public.order_recipes from public, anon, authenticated;
grant select on public.order_recipes to authenticated;
grant all on public.order_recipes to service_role;
create policy order_recipes_owner_read on public.order_recipes for select to authenticated
 using(customer_id=(select auth.uid()));

create function private.valid_recipe_snapshot(r jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare i jsonb; q numeric; n numeric;
begin
 if r is null or jsonb_typeof(r) is distinct from 'object' or octet_length(r::text)>100000
  or jsonb_typeof(r->'title') is distinct from 'string'
  or length(btrim(r->>'title')) not between 3 and 120
  or jsonb_typeof(r->'cooking_minutes') is distinct from 'number'
  or jsonb_typeof(r->'servings') is distinct from 'number'
  or jsonb_typeof(r->'ingredients') is distinct from 'array'
  or jsonb_typeof(r->'steps') is distinct from 'array' then return false; end if;
 n:=(r->>'cooking_minutes')::numeric;
 if n not between 1 and 1440 or trunc(n)<>n then return false; end if;
 n:=(r->>'servings')::numeric;
 if n not between 1 and 20 or trunc(n)<>n then return false; end if;
 if jsonb_array_length(r->'ingredients') not between 1 and 100
  or jsonb_array_length(r->'steps') not between 1 and 30 then return false; end if;
 for i in select value from jsonb_array_elements(r->'ingredients') loop
  if jsonb_typeof(i) is distinct from 'object'
   or jsonb_typeof(i->'name') is distinct from 'string'
   or jsonb_typeof(i->'unit') is distinct from 'string'
   or length(btrim(i->>'name')) not between 1 and 160
   or length(btrim(i->>'unit')) not between 1 and 30
   or jsonb_typeof(i->'quantity') is distinct from 'number' then return false; end if;
  q:=(i->>'quantity')::numeric;
  if q<=0 or q>=10000000 or trunc(q,3)<>q then return false; end if;
 end loop;
 for i in select value from jsonb_array_elements(r->'steps') loop
  if jsonb_typeof(i) is distinct from 'string' or length(btrim(i #>> '{}')) not between 1 and 1500
   then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_recipe_snapshot(jsonb) from public,anon,authenticated;

-- Called within the existing invoker transaction, before publishing its new draft.
-- No authenticated INSERT/UPDATE/DELETE privileges on the recipe table itself.
create function private.save_order_recipe(target_request_id uuid, recipe jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.shopping_requests; caller uuid:=auth.uid();
begin
 if recipe is null or recipe='null'::jsonb then return; end if;
 if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into r from public.shopping_requests where id=target_request_id for update;
 if r.id is null or r.customer_id<>caller or r.status<>'draft' or r.submission_key is null
  then raise exception 'request_not_found' using errcode='42501'; end if;
 if not private.valid_recipe_snapshot(recipe) then
  raise exception 'invalid_request' using errcode='22023'; end if;
 insert into public.order_recipes(request_id,customer_id,snapshot) values(r.id,caller,recipe);
end $$;
revoke all on function private.save_order_recipe(uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_order_recipe(uuid,jsonb) to authenticated;

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
    or (v_budget is null or v_budget <= 0 or v_budget >= 10000000000 or trunc(v_budget,2) <> v_budget)
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
  perform private.save_order_recipe(v_order.id, p_request->'recipe');
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
