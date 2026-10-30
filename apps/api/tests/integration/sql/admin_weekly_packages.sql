-- All test fixtures and successful deletions are rolled back; no live package is deleted.
begin;
select set_config('request.jwt.claim.sub',(select a.user_id::text from public.admin_memberships a join public.profiles p on p.id=a.user_id where p.account_status='active' order by a.user_id limit 1),true);
select set_config('test.package_admin',auth.uid()::text,true);
select set_config('test.package_outsider',(select id::text from public.profiles where account_status='active' and not exists(select 1 from public.admin_memberships where user_id=profiles.id) limit 1),true);
do $$ declare empty_week uuid; used_week uuid; old_week uuid; address uuid; registered uuid; result jsonb;begin
 if auth.uid() is null then raise exception 'active_admin_fixture_required'; end if;
 if current_setting('test.package_outsider',true) is null then raise exception 'outsider_fixture_required'; end if;
 insert into public.weekly_food_weeks(week_start,delivery_deadline,menu,created_by)
 values('2099-01-12','2099-01-11 23:59:59.999999+07','[{"name":"Rollback fixture","quantity":"1 kg"}]',auth.uid()) returning id into empty_week;
 insert into public.weekly_food_weeks(week_start,delivery_deadline,menu,created_by)
 values('2099-01-05','2099-01-04 23:59:59.999999+07','[{"name":"Rollback fixture","quantity":"1 kg"}]',auth.uid()) returning id into used_week;
 insert into public.weekly_food_weeks(week_start,delivery_deadline,menu,published_at,created_by)
 values('2000-01-03','2000-01-02 23:59:59.999999+07','[{"name":"Expired rollback fixture","quantity":"1 kg"}]','1999-12-22',auth.uid()) returning id into old_week;
 result:=public.admin_list_weekly_food_weeks(0,100);
 if not exists(select 1 from jsonb_array_elements(result->'items') row where row->>'id'=old_week::text) then raise exception 'expired_week_hidden_from_admin'; end if;
 if jsonb_array_length(public.admin_list_weekly_food_weeks(0,1)->'items')<>1 then raise exception 'pagination_failed'; end if;
 perform public.admin_delete_weekly_food_week(empty_week);
 if exists(select 1 from public.weekly_food_weeks where id=empty_week) then raise exception 'empty_week_not_deleted'; end if;
 begin
  perform public.admin_delete_weekly_food_week(empty_week); raise exception 'missing_week_was_allowed';
 exception when raise_exception then if sqlerrm<>'week_not_found' then raise; end if; end;
 begin
  perform public.register_weekly_food_order(empty_week,gen_random_uuid(),1,'dinner',gen_random_uuid()); raise exception 'deleted_week_registration_was_allowed';
 exception when raise_exception then if sqlerrm<>'registration_closed' then raise; end if; end;
 insert into public.addresses(owner_id,label,recipient_name,recipient_phone,line1,city)
 values(auth.uid(),'Rollback package test','Test','0900000000','Rollback fixture','Đà Nẵng') returning id into address;
 registered:=public.register_weekly_food_order(used_week,address,1,'dinner',gen_random_uuid());
 begin
  perform public.admin_delete_weekly_food_week(used_week); raise exception 'registered_package_deleted';
 exception when raise_exception then if sqlerrm<>'week_has_orders' then raise; end if; end;
 perform public.act_weekly_food_order(registered,'cancel');
 begin
  perform public.admin_delete_weekly_food_week(used_week); raise exception 'cancelled_package_deleted';
 exception when raise_exception then if sqlerrm<>'week_has_orders' then raise; end if; end;
 -- Fixture represents an already completed order; no user workflow is advanced.
 update public.weekly_food_orders set status='completed',shopper_id=auth.uid(),accepted_at=now(),handover_at=now(),delivered_at=now(),completed_at=now() where id=registered;
 begin
  perform public.admin_delete_weekly_food_week(used_week); raise exception 'completed_package_deleted';
 exception when raise_exception then if sqlerrm<>'week_has_orders' then raise; end if; end;
 result:=public.admin_list_weekly_food_weeks(0,100);
 if not exists(select 1 from jsonb_array_elements(result->'items') row where row->>'id'=used_week::text and (row->>'order_count')::int=1) then raise exception 'all_status_order_count_failed'; end if;
 perform set_config('test.package_week',used_week::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.package_outsider'),true);
do $$ begin
 begin
  perform public.admin_list_weekly_food_weeks(); raise exception 'outsider_list_allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.admin_delete_weekly_food_week(current_setting('test.package_week')::uuid); raise exception 'outsider_delete_allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.package_admin'),true);
delete from public.admin_memberships where user_id=auth.uid();
set local role authenticated;
do $$ begin
 begin
  perform public.admin_list_weekly_food_weeks(); raise exception 'revoked_admin_list_allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.admin_delete_weekly_food_week(current_setting('test.package_week')::uuid); raise exception 'revoked_admin_delete_allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.admin_delete_weekly_food_week(uuid)','EXECUTE') or has_function_privilege('anon','public.admin_list_weekly_food_weeks(integer,integer)','EXECUTE') then raise exception 'anonymous_access_granted'; end if;
end $$;
rollback;
select 'package list, deletion, order retention and permissions passed; all fixtures rolled back' as result;
