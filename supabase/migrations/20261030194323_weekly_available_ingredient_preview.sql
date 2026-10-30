-- Published ingredients can be reviewed before acceptance. Customer contact
-- and exact address remain available only through the assigned-order detail.
create or replace function public.list_available_weekly_food_orders(page_limit integer default 25,page_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then raise exception 'account_inactive';end if;
 if page_limit not between 1 and 100 or page_offset<0 then raise exception 'invalid_filter';end if;
 return coalesce((select jsonb_agg(to_jsonb(o)) from (
  select r.id,r.people,r.meals,r.price,25000 as wage,r.delivery_deadline,r.created_at,
  jsonb_build_object('id',w.id,'week_start',w.week_start,'delivery_deadline',w.delivery_deadline,'menu',w.menu,'published_at',w.published_at) as week
  from public.weekly_food_orders r join public.weekly_food_weeks w on w.id=r.week_id where r.status='registered' and r.customer_id<>auth.uid()
  and now()>r.delivery_deadline-interval '7 days' and now()<=r.delivery_deadline
  and not exists(select 1 from public.weekly_food_assignments a where a.order_id=r.id and a.shopper_id=auth.uid())
  order by r.delivery_deadline,r.created_at,r.id limit page_limit offset page_offset
 ) o),'[]'::jsonb);
end $$;
revoke all on function public.list_available_weekly_food_orders(integer,integer) from public,anon,service_role;
grant execute on function public.list_available_weekly_food_orders(integer,integer) to authenticated;
