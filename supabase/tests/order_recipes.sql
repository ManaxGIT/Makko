-- Synthetic data and any order/status changes are always rolled back.
begin;
do $$
declare owner_id uuid; shopper_id uuid; a jsonb; body jsonb; result jsonb; recipe jsonb; target_id uuid; before_count bigint;
begin
 select id into owner_id from public.profiles where account_status='active' order by id limit 1;
 select id into shopper_id from public.profiles where account_status='active' and id<>owner_id order by id limit 1;
 if shopper_id is null then raise exception 'Requires two active profiles'; end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 a:=public.create_delivery_address(jsonb_build_object('label','Recipe test','recipient_name','Test','recipient_phone','0901234567','line1','Test only','province_code','79','ward_code','26740','is_default',false));
 recipe:='{"title":"Súp bí đỏ","cooking_minutes":30,"servings":2,"ingredients":[{"name":"Bơ lạt","quantity":20,"unit":"g"}],"steps":["Nấu chín nguyên liệu."]}'::jsonb;
 body:=jsonb_build_object('submission_key','test-recipe-atomic-0001','address_id',a->>'id','title','Recipe test',
  'deliver_by',now()+interval '1 day','delivery_fee',25000,'estimated_items_total',100000,'payment_method','cash',
  'items',jsonb_build_array(jsonb_build_object('name','Bơ lạt','quantity',1,'unit','gói','note','Gói nhỏ, tối thiểu 20 g')),'recipe',recipe);
 result:=public.create_and_publish_request(body);target_id:=(result->>'request_id')::uuid;
 if (select snapshot from public.order_recipes where request_id=target_id) is distinct from recipe then raise exception 'FAIL saved snapshot'; end if;
 if (public.create_and_publish_request(body)->>'request_id')::uuid<>target_id then raise exception 'FAIL retry'; end if;
 if (select count(*) from public.order_recipes where request_id=target_id)<>1 then raise exception 'FAIL duplicate snapshot'; end if;
 -- A retry cannot replace the recipe, even with a different body.
 perform public.create_and_publish_request(body||jsonb_build_object('recipe',jsonb_set(recipe,'{title}','"Changed recipe"')));
 if (select snapshot from public.order_recipes where request_id=target_id) is distinct from recipe then raise exception 'FAIL immutable retry'; end if;
 select count(*) into before_count from public.shopping_requests where customer_id=owner_id;
 begin
  perform public.create_and_publish_request(body||jsonb_build_object('submission_key','test-recipe-invalid-0001','recipe',jsonb_set(recipe,'{steps}','[]')));
  raise exception 'FAIL invalid recipe accepted';
 exception when sqlstate '22023' then null; end;
 if (select count(*) from public.shopping_requests where customer_id=owner_id)<>before_count then raise exception 'FAIL orphan request'; end if;
 begin
  update public.order_recipes set snapshot=recipe where request_id=target_id;
  raise exception 'FAIL snapshot writable directly';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.order_recipes where request_id=target_id;
  raise exception 'FAIL snapshot deletable directly';
 exception when insufficient_privilege then null; end;
 -- Assigned shopper can read the order but cannot read its recipe.
 perform set_config('request.jwt.claim.sub',shopper_id::text,true);
 perform public.accept_request(target_id);
 if not exists(select 1 from public.shopping_requests where id=target_id) then raise exception 'FAIL shopper order visibility'; end if;
 if exists(select 1 from public.order_recipes where request_id=target_id) then raise exception 'FAIL shopper recipe exposure'; end if;
 begin
  insert into public.order_recipes(request_id,customer_id,snapshot) values(target_id,shopper_id,recipe);
  raise exception 'FAIL direct recipe insertion';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if not exists(select 1 from public.order_recipes where request_id=target_id) then raise exception 'FAIL owner lost recipe after acceptance'; end if;
 execute 'reset role';
end $$;
rollback;
