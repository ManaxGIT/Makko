-- Admin membership is provisioned manually; no client can modify it.
create table public.admin_memberships (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.admin_memberships enable row level security;
revoke all on public.admin_memberships from public, anon, authenticated;
grant select on public.admin_memberships to service_role;

create or replace function private.require_makko_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
 if caller is null or not exists (select 1 from public.admin_memberships a join public.profiles p on p.id=a.user_id where a.user_id=caller and p.account_status='active') then
  raise exception 'admin_required' using errcode='42501';
 end if;
 return caller;
end $$;
revoke all on function private.require_makko_admin() from public,anon,authenticated,service_role;

create table public.weekly_food_weeks (
 id uuid primary key default gen_random_uuid(),
 week_start date not null unique check(extract(isodow from week_start)=1),
 -- End of the Sunday before the consumption week, in Da Nang local time.
 delivery_deadline timestamptz not null,
 menu jsonb not null check(jsonb_typeof(menu)='array' and jsonb_array_length(menu)=7),
 published_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id),
 check(delivery_deadline=((week_start::timestamp at time zone 'Asia/Ho_Chi_Minh')-interval '1 microsecond')),
 check(published_at <= delivery_deadline-interval '10 days')
);
create table public.weekly_food_orders (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id),
 week_id uuid not null references public.weekly_food_weeks(id),
 submission_key uuid not null,
 people integer not null check(people between 1 and 4),
 meals text not null check(meals in ('lunch','dinner','both')),
 price integer not null check(price>0),
 status text not null default 'registered' check(status in ('registered','accepted','delivering','delivered','completed','cancelled')),
 delivery_deadline timestamptz not null,
 recipient_name text not null,recipient_phone text not null,
 delivery_address text not null,
 shopper_id uuid references public.profiles(id),
 accepted_at timestamptz,
 handover_at timestamptz, handover_by uuid references public.profiles(id),
 delivered_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 wage_paid_at timestamptz, wage_paid_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(customer_id,submission_key),
 check((shopper_id is null)=(accepted_at is null)),
 check(status not in ('accepted','delivering','delivered','completed') or shopper_id is not null),
 check(status not in ('delivering','delivered','completed') or handover_at is not null),
 check(status not in ('delivered','completed') or delivered_at is not null),
 check(status<>'completed' or completed_at is not null),
 check(wage_paid_at is null or status='completed')
);
create index weekly_food_orders_created_idx on public.weekly_food_orders(created_at desc,id desc);
create index weekly_food_orders_customer_idx on public.weekly_food_orders(customer_id,created_at desc);
create index weekly_food_orders_shopper_idx on public.weekly_food_orders(shopper_id) where shopper_id is not null;
create index weekly_food_orders_week_idx on public.weekly_food_orders(week_id);
create table public.weekly_food_assignments (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.weekly_food_orders(id),
 shopper_id uuid not null references public.profiles(id),accepted_at timestamptz not null default now(),released_at timestamptz,
 unique(order_id,shopper_id)
);
create unique index weekly_food_assignments_active_idx on public.weekly_food_assignments(order_id) where released_at is null;
create index weekly_food_assignments_shopper_idx on public.weekly_food_assignments(shopper_id);
create table public.weekly_food_delivery_evidence (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.weekly_food_orders(id),
 uploaded_by uuid not null references public.profiles(id),storage_path text not null unique,created_at timestamptz not null default now()
);
create index weekly_food_evidence_order_idx on public.weekly_food_delivery_evidence(order_id);
do $$ declare t text; begin
 foreach t in array array['weekly_food_weeks','weekly_food_orders','weekly_food_assignments','weekly_food_delivery_evidence'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to service_role',t);
 end loop;
end $$;

create function public.admin_publish_weekly_food_week(week_start_date date,week_menu jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=private.require_makko_admin(); result uuid;begin
 insert into public.weekly_food_weeks(week_start,delivery_deadline,menu,created_by)
 values(week_start_date,(week_start_date::timestamp at time zone 'Asia/Ho_Chi_Minh')-interval '1 microsecond',week_menu,caller) returning id into result;
 return result;
end $$;

create function public.register_weekly_food_order(target_week_id uuid,address_id uuid,people_count integer,meal_option text,idempotency_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); w public.weekly_food_weeks; a public.addresses; r public.weekly_food_orders; amount integer;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and account_status='active') then raise exception 'account_inactive';end if;
 -- Serialize retries for this customer's submission, without locking other customers.
 perform pg_advisory_xact_lock(hashtextextended(caller::text||idempotency_key::text,0));
 select * into r from public.weekly_food_orders where customer_id=caller and submission_key=idempotency_key;
 if found then
  if r.week_id<>target_week_id or r.people<>people_count or r.meals<>meal_option then raise exception 'submission_conflict';end if;
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
 insert into public.weekly_food_orders(customer_id,week_id,submission_key,people,meals,price,delivery_deadline,recipient_name,recipient_phone,delivery_address)
 values(caller,w.id,idempotency_key,people_count,meal_option,amount,w.delivery_deadline,a.recipient_name,a.recipient_phone,concat_ws(', ',a.line1,a.line2,a.ward,a.district,a.city)) returning id into caller;
 return caller;
end $$;

create function public.act_weekly_food_order(target_order_id uuid,action_name text,photo_paths text[] default '{}') returns text
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); r public.weekly_food_orders; p text; actor uuid;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and account_status='active') then raise exception 'account_inactive';end if;
 -- Lock membership before the order for admin operations; revocation cannot race a write.
 if action_name in ('handover','pay_wage') then
  actor:=private.require_makko_admin();
  perform 1 from public.admin_memberships where user_id=actor for share;
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

-- Only backend service reads this view. Clients use the authorized admin RPCs below.
create view public.admin_order_rows with(security_invoker=true) as
 select r.id,'errand'::text as type,r.title,r.status::text,r.customer_id,p.display_name as customer_name,
 a.shopper_id,s.display_name as shopper_name,r.estimated_items_total as price,r.delivery_fee as fee,
 r.deliver_by as delivery_deadline,r.created_at,r.completed_at,
 null::timestamptz as handover_at,null::timestamptz as wage_paid_at,
 r.delivery_recipient_name as recipient_name,r.delivery_phone as recipient_phone,
 concat_ws(', ',r.delivery_line1,r.delivery_line2,r.delivery_ward,r.delivery_district,r.delivery_city) as delivery_address
 from public.shopping_requests r join public.profiles p on p.id=r.customer_id
 left join public.request_assignments a on a.request_id=r.id and a.released_at is null
 left join public.profiles s on s.id=a.shopper_id
 union all
 select r.id,'weekly',r.people||' người · '||case r.meals when 'lunch' then 'Chỉ trưa' when 'dinner' then 'Chỉ tối' else 'Trưa và tối' end,
 case when r.status='registered' and now()>r.delivery_deadline-interval '7 days' then 'open' else r.status end,
 r.customer_id,p.display_name,r.shopper_id,s.display_name,r.price,25000,r.delivery_deadline,r.created_at,r.completed_at,r.handover_at,r.wage_paid_at,r.recipient_name,r.recipient_phone,r.delivery_address
 from public.weekly_food_orders r join public.profiles p on p.id=r.customer_id left join public.profiles s on s.id=r.shopper_id;
revoke all on public.admin_order_rows from public,anon,authenticated;
grant select on public.admin_order_rows to service_role;

create function public.admin_list_orders(order_type text default 'all',status_filter text default 'all',search_query text default '',work_queue text default 'all',page_offset integer default 0,page_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_makko_admin();
 if order_type not in ('all','weekly','errand') or work_queue not in ('all','handover','wages') or page_offset<0 or page_limit not between 1 and 100 or char_length(search_query)>120 then raise exception 'invalid_filter';end if;
 with filtered as (
 select * from public.admin_order_rows o where (order_type='all' or o.type=order_type)
 and(status_filter='all' or o.status=status_filter)
 and(work_queue='all' or work_queue='handover' and o.type='weekly' and o.status='accepted' or work_queue='wages' and o.type='weekly' and o.status='completed' and o.wage_paid_at is null)
 and(search_query='' or strpos(lower(concat_ws(' ',o.id::text,o.title,o.customer_name,o.shopper_name)),lower(search_query))>0)
 ), paged as(select * from filtered order by created_at desc,id desc limit page_limit offset page_offset)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc,id desc) from paged),'[]'::jsonb),'total',(select count(*) from filtered),'stats',
 (select jsonb_build_object('total',count(*),'handover',count(*) filter(where type='weekly' and status='accepted'),'delivering',count(*) filter(where status='delivering'),'wages',count(*) filter(where type='weekly' and status='completed' and wage_paid_at is null)) from public.admin_order_rows)) into result;
 return result;
end $$;

create function public.admin_get_order(target_order_id uuid,order_type text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_makko_admin();
 select to_jsonb(o) into result from public.admin_order_rows o where o.id=target_order_id and o.type=order_type;
 if result is null then raise exception 'order_not_found';end if;
 if order_type='errand' then
  result:=result||jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'unit',unit,'note',note) order by sort_order) from public.request_items where request_id=target_order_id),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(jsonb_build_object('status',to_status,'created_at',created_at) order by created_at,id) from public.request_status_history where request_id=target_order_id),'[]'::jsonb));
 else
  result:=result||jsonb_build_object('menu',(select w.menu from public.weekly_food_weeks w join public.weekly_food_orders o on o.week_id=w.id where o.id=target_order_id),'items','[]'::jsonb,'history','[]'::jsonb);
 end if;
 return result;
end $$;

-- Public execution is always revoked explicitly, including PostgreSQL's default PUBLIC grant.
revoke all on function public.admin_publish_weekly_food_week(date,jsonb),public.register_weekly_food_order(uuid,uuid,integer,text,uuid),public.act_weekly_food_order(uuid,text,text[]),public.admin_list_orders(text,text,text,text,integer,integer),public.admin_get_order(uuid,text) from public,anon,service_role;
grant execute on function public.admin_publish_weekly_food_week(date,jsonb),public.register_weekly_food_order(uuid,uuid,integer,text,uuid),public.act_weekly_food_order(uuid,text,text[]),public.admin_list_orders(text,text,text,text,integer,integer),public.admin_get_order(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('weekly-food-delivery','weekly-food-delivery',false,10485760,array['image/jpeg','image/png','image/webp']);
create function private.can_upload_weekly_delivery(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.weekly_food_orders o join public.profiles p on p.id=o.shopper_id
 where o.id::text=split_part(object_name,'/',2) and o.shopper_id=auth.uid() and p.account_status='active' and o.status='delivering' and split_part(object_name,'/',1)=auth.uid()::text)
$$;
revoke all on function private.can_upload_weekly_delivery(text) from public,anon,service_role;
grant execute on function private.can_upload_weekly_delivery(text) to authenticated;
create policy weekly_delivery_upload on storage.objects for insert to authenticated with check(bucket_id='weekly-food-delivery' and private.can_upload_weekly_delivery(name));
-- Uploaded evidence is immutable. Signing/reading is handled through backend authorization.
