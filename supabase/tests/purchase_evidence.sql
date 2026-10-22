-- Transaction-only fixtures. No test order changes or Storage metadata persist.
begin;
do $$ begin
 if not has_table_privilege('service_role','public.purchase_evidence','SELECT') then
  raise exception 'FAIL backend cannot read evidence';
 end if;
end $$;
do $$
declare r public.shopping_requests; shopper uuid; outsider uuid; ids uuid[]; path text; result jsonb; before_total numeric; n integer;
begin
 select * into r from public.shopping_requests where status='shopping' limit 1;
 if r.id is null then raise exception 'Test requires a shopping order'; end if;
 select shopper_id into shopper from public.request_assignments where request_id=r.id and released_at is null;
 select id into outsider from public.profiles where id not in (shopper,r.customer_id) limit 1;
 select array_agg(id) into ids from public.request_items where request_id=r.id;
 before_total:=r.estimated_items_total;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.submit_purchase_evidence(r.id,ids,'[]'::jsonb);
  raise exception 'FAIL outsider permitted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',shopper::text,true);
 begin
  perform public.transition_request(r.id,'delivering');
  raise exception 'FAIL bypass permitted';
 exception when raise_exception then if sqlerrm<>'invalid_status_transition' then raise; end if; end;
 begin
  perform public.submit_purchase_evidence(r.id,array[]::uuid[],'[]'::jsonb);
  raise exception 'FAIL missing item permitted';
 exception when raise_exception then if sqlerrm<>'items_not_confirmed' then raise; end if; end;
 begin
  perform public.submit_purchase_evidence(r.id,ids,jsonb_build_array(jsonb_build_object('kind','receipt','storage_path','missing')));
  raise exception 'FAIL receipt-only permitted';
 exception when raise_exception then if sqlerrm<>'goods_photo_required' then raise; end if; end;
 begin
  perform public.submit_purchase_evidence(r.id,ids,jsonb_build_array(jsonb_build_object('kind','goods','storage_path','missing')));
  raise exception 'FAIL nonexistent object permitted';
 exception when raise_exception then if sqlerrm<>'invalid_evidence' then raise; end if; end;
 -- Synthetic metadata only for testing DB object checks; rolled back, not an actual file upload.
 path:=shopper::text||'/'||r.id::text||'/transaction-test.jpg';
 execute 'set local role authenticated';
 insert into storage.objects(bucket_id,name,owner_id) values('purchase-evidence',path,shopper::text);
 execute 'set local role authenticated';
 result:=public.submit_purchase_evidence(r.id,ids,jsonb_build_array(jsonb_build_object('kind','goods','storage_path',path)));
 if result->>'status'<>'delivering' then raise exception 'FAIL final transition'; end if;
 perform public.submit_purchase_evidence(r.id,ids,jsonb_build_array(jsonb_build_object('kind','goods','storage_path',path)));
 select count(*) into n from public.purchase_evidence where request_id=r.id;
 if n<>1 then raise exception 'FAIL duplicate evidence'; end if;
 if (select estimated_items_total from public.shopping_requests where id=r.id)<>before_total then raise exception 'FAIL price changed'; end if;
 if has_table_privilege('authenticated','public.purchase_evidence','INSERT') then raise exception 'FAIL metadata write grant'; end if;
 perform set_config('request.jwt.claim.sub',r.customer_id::text,true);
 if not exists(select 1 from storage.objects where bucket_id='purchase-evidence' and name=path) then raise exception 'FAIL customer cannot view'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from storage.objects where bucket_id='purchase-evidence' and name=path) then raise exception 'FAIL outsider can view'; end if;
 if exists(select 1 from public.purchase_evidence where request_id=r.id) then raise exception 'FAIL outsider sees metadata'; end if;
 execute 'reset role';

end $$;
rollback;
