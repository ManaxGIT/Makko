-- Preserve every package referenced by an order, including cancelled orders.
create function public.admin_list_weekly_food_weeks(page_offset integer default 0, page_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_makko_admin();
 if page_offset < 0 or page_limit < 1 or page_limit > 100 then raise exception 'invalid_pagination'; end if;
 select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(rows) order by rows.week_start desc, rows.id desc) from (
   select w.*, (select count(*) from public.weekly_food_orders o where o.week_id=w.id) as order_count
   from public.weekly_food_weeks w order by w.week_start desc,w.id desc limit page_limit offset page_offset
  ) rows),'[]'::jsonb),
  'total', (select count(*) from public.weekly_food_weeks)
 ) into result;
 return result;
end $$;

create function public.admin_delete_weekly_food_week(target_week_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_makko_admin();
 -- Registration holds KEY SHARE on this same row until its order is committed.
 perform 1 from public.weekly_food_weeks where id=target_week_id for update;
 if not found then raise exception 'week_not_found'; end if;
 if exists(select 1 from public.weekly_food_orders where week_id=target_week_id) then
  raise exception 'week_has_orders';
 end if;
 delete from public.weekly_food_weeks where id=target_week_id;
 return target_week_id;
exception when foreign_key_violation then
 -- Also guard callers that insert orders outside the registration RPC.
 raise exception 'week_has_orders';
end $$;

revoke all on function public.admin_list_weekly_food_weeks(integer,integer), public.admin_delete_weekly_food_week(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_list_weekly_food_weeks(integer,integer), public.admin_delete_weekly_food_week(uuid) to authenticated;

-- Keep registration and deletion serialized; all other invariants are unchanged.
create or replace function public.register_weekly_food_order(target_week_id uuid,address_id uuid,people_count integer,meal_option text,idempotency_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); w public.weekly_food_weeks; a public.addresses; r public.weekly_food_orders; amount integer;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and account_status='active') then raise exception 'account_inactive';end if;
 -- Serialize retries for this customer's submission, without locking other customers.
 perform pg_advisory_xact_lock(hashtextextended(caller::text||idempotency_key::text,0));
 select * into r from public.weekly_food_orders where customer_id=caller and submission_key=idempotency_key;
 if found then
  if r.source_address_id is distinct from address_id or r.week_id<>target_week_id or r.people<>people_count or r.meals<>meal_option then raise exception 'submission_conflict';end if;
  return r.id;
 end if;
 select * into w from public.weekly_food_weeks where id=target_week_id for key share;
 if not found or now()>w.delivery_deadline-interval '7 days' then raise exception 'registration_closed';end if;
 select * into a from public.addresses where id=address_id and owner_id=caller for share;
 if not found or not coalesce(a.province_code='48' or a.city in ('Đà Nẵng','Thành phố Đà Nẵng'),false) then raise exception 'invalid_address';end if;
 if people_count not between 1 and 4 or meal_option not in ('lunch','dinner','both') then raise exception 'invalid_package';end if;
 amount:=case people_count when 1 then case when meal_option='both' then 459000 else 249000 end
 when 2 then case when meal_option='both' then 829000 else 449000 end
 when 3 then case when meal_option='both' then 1199000 else 649000 end
 when 4 then case when meal_option='both' then 1569000 else 849000 end end;
 insert into public.weekly_food_orders(customer_id,source_address_id,week_id,submission_key,people,meals,price,delivery_deadline,recipient_name,recipient_phone,delivery_address)
 values(caller,a.id,w.id,idempotency_key,people_count,meal_option,amount,w.delivery_deadline,a.recipient_name,a.recipient_phone,concat_ws(', ',a.line1,a.line2,a.ward,a.district,a.city)) returning id into caller;
 return caller;
end $$;
