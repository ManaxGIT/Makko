alter table public.weekly_food_orders add column source_address_id uuid references public.addresses(id) on delete set null;
create index weekly_food_orders_address_idx on public.weekly_food_orders(source_address_id) where source_address_id is not null;
create index weekly_food_weeks_creator_idx on public.weekly_food_weeks(created_by);
create index weekly_food_orders_handover_by_idx on public.weekly_food_orders(handover_by) where handover_by is not null;
create index weekly_food_orders_wage_by_idx on public.weekly_food_orders(wage_paid_by) where wage_paid_by is not null;
create index weekly_food_evidence_uploader_idx on public.weekly_food_delivery_evidence(uploaded_by);
create or replace function public.admin_publish_weekly_food_week(week_start_date date,week_menu jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=private.require_makko_admin(); result uuid;begin
 perform 1 from public.admin_memberships where user_id=caller for share;
 if not found then raise exception 'admin_required' using errcode='42501';end if;
 insert into public.weekly_food_weeks(week_start,delivery_deadline,menu,created_by)
 values(week_start_date,(week_start_date::timestamp at time zone 'Asia/Ho_Chi_Minh')-interval '1 microsecond',week_menu,caller) returning id into result;
 return result;
end $$;

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
 select * into w from public.weekly_food_weeks where id=target_week_id;
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

create or replace function public.act_weekly_food_order(target_order_id uuid,action_name text,photo_paths text[] default '{}') returns text
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); r public.weekly_food_orders; p text; actor uuid;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and account_status='active') then raise exception 'account_inactive';end if;
 -- Lock membership before the order for admin operations; revocation cannot race a write.
 if action_name in ('handover','pay_wage') then
  actor:=private.require_makko_admin();
  perform 1 from public.admin_memberships where user_id=actor for share;
  if not found then raise exception 'admin_required' using errcode='42501';end if;
 end if;
 select * into r from public.weekly_food_orders where id=target_order_id for update;
 if not found then raise exception 'order_not_found';end if;
 if action_name='cancel' then
  if r.customer_id<>caller then raise exception 'order_not_found';end if;
  if r.status<>'registered' or now()>r.delivery_deadline-interval '7 days' then raise exception 'invalid_transition';end if;
  update public.weekly_food_orders set status='cancelled',cancelled_at=now() where id=r.id;
 elsif action_name='accept' then
  if r.customer_id=caller or r.status<>'registered' or now()<=r.delivery_deadline-interval '7 days' or now()>r.delivery_deadline then raise exception 'invalid_transition';end if;
  if exists(select 1 from public.weekly_food_assignments where order_id=r.id and shopper_id=caller) then raise exception 'cannot_reaccept';end if;
  insert into public.weekly_food_assignments(order_id,shopper_id) values(r.id,caller);
  update public.weekly_food_orders set status='accepted',shopper_id=caller,accepted_at=now() where id=r.id;
 elsif action_name='release' then
  if r.shopper_id is distinct from caller then raise exception 'order_not_found';end if;
  if r.status<>'accepted' or now()>r.accepted_at+interval '24 hours' or now()>r.delivery_deadline-interval '3 days' then raise exception 'invalid_transition';end if;
  update public.weekly_food_assignments set released_at=now() where order_id=r.id and released_at is null;
  update public.weekly_food_orders set status='registered',shopper_id=null,accepted_at=null where id=r.id;
 elsif action_name='handover' then
  if r.status<>'accepted' then raise exception 'invalid_transition';end if;
  update public.weekly_food_orders set status='delivering',handover_at=now(),handover_by=caller where id=r.id;
 elsif action_name='deliver' then
  if r.shopper_id is distinct from caller then raise exception 'order_not_found';end if;
  if r.status<>'delivering' then raise exception 'invalid_transition';end if;
  if cardinality(photo_paths) not between 1 and 10 then raise exception 'delivery_photo_required';end if;
  foreach p in array photo_paths loop
   if p not like caller::text||'/'||r.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='weekly-food-delivery' and name=p and owner_id=caller::text) then raise exception 'invalid_evidence';end if;
   insert into public.weekly_food_delivery_evidence(order_id,uploaded_by,storage_path) values(r.id,caller,p);
  end loop;
  update public.weekly_food_orders set status='delivered',delivered_at=now() where id=r.id;
 elsif action_name='receive' then
  if r.customer_id<>caller then raise exception 'order_not_found';end if;
  if r.status<>'delivered' then raise exception 'invalid_transition';end if;
  update public.weekly_food_orders set status='completed',completed_at=now() where id=r.id;
 elsif action_name='pay_wage' then
  if r.status<>'completed' or r.wage_paid_at is not null then raise exception 'invalid_transition';end if;
  update public.weekly_food_orders set wage_paid_at=now(),wage_paid_by=caller where id=r.id;
 else raise exception 'invalid_action';end if;
 return (select status from public.weekly_food_orders where id=r.id);
end $$;
