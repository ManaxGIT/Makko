-- Run in one session; all fixtures and mutations are rolled back.
begin;
select set_config('request.jwt.claim.sub',(select a.user_id::text from public.admin_memberships a join public.profiles p on p.id=a.user_id where p.account_status='active' order by a.user_id limit 1),true);
select set_config('test.customer',auth.uid()::text,true);
select set_config('test.shopper',(select id::text from public.profiles where account_status='active' and id<>auth.uid() and not exists(select 1 from public.admin_memberships where user_id=profiles.id) limit 1),true);
do $$ begin
 if current_setting('test.shopper',true) is null or current_setting('test.shopper')='' then raise exception 'test_requires_second_active_account';end if;
 if public.admin_list_orders()->>'total' is null then raise exception 'admin_list_failed';end if;
end $$;
set local role authenticated;
do $$ begin
 begin
  insert into public.admin_memberships(user_id) values(auth.uid());
  raise exception 'membership_write_was_allowed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.shopper'),true);
do $$ begin
 begin
  perform public.admin_list_orders();raise exception 'outsider_read_was_allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.admin_get_order(gen_random_uuid(),'errand');raise exception 'outsider_detail_was_allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.customer'),true);
do $$ declare w uuid; a uuid; r uuid; retry uuid;begin
 insert into public.weekly_food_weeks(week_start,delivery_deadline,menu,created_by)
 values('2099-01-05','2099-01-04 23:59:59.999999+07', '[{"name":"Gạo","quantity":"1 kg"}]' ,auth.uid()) returning id into w;
 insert into public.addresses(owner_id,label,recipient_name,recipient_phone,line1,city)
 values(auth.uid(),'SQL test','Test','0900000000','Test address','Đà Nẵng') returning id into a;
 r:=public.register_weekly_food_order(w,a,2,'both','11111111-1111-4111-8111-111111111111');
 retry:=public.register_weekly_food_order(w,a,2,'both','11111111-1111-4111-8111-111111111111');
 if retry<>r or (select price from public.weekly_food_orders where id=r)<>829000 then raise exception 'registration_retry_or_price_failed';end if;
 update public.addresses set line1='Changed' where id=a;
 if (select delivery_address from public.weekly_food_orders where id=r) not like 'Test address%' then raise exception 'snapshot_was_rewritten';end if;
 perform public.act_weekly_food_order(r,'cancel');
 if (select status from public.weekly_food_orders where id=r)<>'cancelled' then raise exception 'cancel_failed';end if;
 -- Open order fixture; five days exercises the 24-hour / 72-hour release window.
 insert into public.weekly_food_orders(customer_id,week_id,submission_key,people,meals,price,delivery_deadline,recipient_name,recipient_phone,delivery_address)
 values(auth.uid(),w,gen_random_uuid(),1,'lunch',249000,now()+interval '5 days','Test','0900000000','Test') returning id into r;
 perform set_config('test.order',r::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.shopper'),true);
do $$ declare r uuid:=current_setting('test.order')::uuid;begin
 perform public.act_weekly_food_order(r,'accept');
 perform public.act_weekly_food_order(r,'release');
 begin
  perform public.act_weekly_food_order(r,'accept');raise exception 'reaccept_was_allowed';
 exception when raise_exception then if sqlerrm<>'cannot_reaccept' then raise;end if;end;
 -- Fresh assignment for handover tests.
 delete from public.weekly_food_assignments where order_id=r;
 perform public.act_weekly_food_order(r,'accept');
 begin
  perform public.act_weekly_food_order(r,'handover');raise exception 'shopper_handover_was_allowed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.customer'),true);
do $$ declare r uuid:=current_setting('test.order')::uuid;begin
 perform public.act_weekly_food_order(r,'handover');
 begin
  perform public.act_weekly_food_order(r,'handover');raise exception 'double_handover_was_allowed';
 exception when raise_exception then if sqlerrm<>'invalid_transition' then raise;end if;end;
 begin
  perform public.act_weekly_food_order(r,'pay_wage');raise exception 'early_wage_was_allowed';
 exception when raise_exception then if sqlerrm<>'invalid_transition' then raise;end if;end;
 begin
  perform public.act_weekly_food_order(r,'receive');raise exception 'customer_skipped_handoff';
 exception when raise_exception then if sqlerrm<>'invalid_transition' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.shopper'),true);
do $$ begin
 begin
  perform public.act_weekly_food_order(current_setting('test.order')::uuid,'deliver','{}');raise exception 'no_photo_delivery_was_allowed';
 exception when raise_exception then if sqlerrm<>'delivery_photo_required' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.customer'),true);
do $$ declare r uuid:=current_setting('test.order')::uuid;begin
 -- Fixture simulates successful immutable photo registration, never writes Storage.
 update public.weekly_food_orders set status='delivered',delivered_at=now() where id=r;
 perform public.act_weekly_food_order(r,'receive');
 perform public.act_weekly_food_order(r,'pay_wage');
 begin
  perform public.act_weekly_food_order(r,'pay_wage');raise exception 'double_wage_was_allowed';
 exception when raise_exception then if sqlerrm<>'invalid_transition' then raise;end if;end;
 -- Revoking membership takes effect without changing the token claims.
 delete from public.admin_memberships where user_id=auth.uid();
 begin
  perform public.admin_list_orders();raise exception 'revocation_was_ignored';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
