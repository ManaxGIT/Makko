-- Reuse private evidence Storage; classify handoff photos separately.
alter table public.purchase_evidence drop constraint purchase_evidence_kind_check;
alter table public.purchase_evidence add constraint purchase_evidence_kind_check
check (kind in ('goods','receipt','delivery'));

alter policy evidence_upload on storage.objects with check (
 bucket_id='purchase-evidence' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.shopping_requests r join public.request_assignments a on a.request_id=r.id
 where r.id::text=(storage.foldername(name))[2] and r.status in ('shopping','delivering')
 and a.shopper_id=auth.uid() and a.released_at is null)
);

create or replace function private.submit_delivery_evidence(target_request_id uuid, photos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.shopping_requests; photo jsonb; caller uuid:=auth.uid();
begin
 if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into r from public.shopping_requests where id=target_request_id for update;
 if r.id is null or not private.is_active_shopper(target_request_id) then
  raise exception 'request_not_found' using errcode='42501'; end if;
 -- Retry a lost response without duplicate photos or status history.
 if r.status in ('delivered','completed') and exists(
  select 1 from public.purchase_evidence where request_id=r.id and kind='delivery' and uploaded_by=caller
 ) then return jsonb_build_object('request_id',r.id,'status',r.status); end if;
 if r.status<>'delivering' then raise exception 'request_not_delivering'; end if;
 if jsonb_typeof(photos) is distinct from 'array' then raise exception 'invalid_evidence'; end if;
 if jsonb_array_length(photos)=0 then raise exception 'delivery_photo_required'; end if;
 if jsonb_array_length(photos)>20 then raise exception 'invalid_evidence'; end if;
 for photo in select value from jsonb_array_elements(photos) loop
  if coalesce(photo->>'kind','')<>'delivery' or not exists(
   select 1 from storage.objects o where o.bucket_id='purchase-evidence'
   and o.name=photo->>'storage_path' and o.owner_id=caller::text
   and (storage.foldername(o.name))[1]=caller::text
   and (storage.foldername(o.name))[2]=r.id::text
  ) or exists(select 1 from public.purchase_evidence e where e.storage_path=photo->>'storage_path')
  then raise exception 'invalid_evidence'; end if;
  insert into public.purchase_evidence(request_id,uploaded_by,kind,storage_path)
  values(r.id,caller,'delivery',photo->>'storage_path');
 end loop;
 perform public.transition_request(r.id,'delivered');
 return jsonb_build_object('request_id',r.id,'status','delivered');
end $$;
revoke all on function private.submit_delivery_evidence(uuid,jsonb) from public,anon;
grant execute on function private.submit_delivery_evidence(uuid,jsonb) to authenticated;
create or replace function public.submit_delivery_evidence(target_request_id uuid, photos jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.submit_delivery_evidence(target_request_id,photos);
$$;
revoke all on function public.submit_delivery_evidence(uuid,jsonb) from public,anon;
grant execute on function public.submit_delivery_evidence(uuid,jsonb) to authenticated;

create or replace function public.transition_request(
  target_request_id uuid,
  target_status public.request_status
)
returns public.shopping_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_request public.shopping_requests;
  changed_request public.shopping_requests;
  caller_id uuid := (select auth.uid());
  caller_is_shopper boolean;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into current_request
  from public.shopping_requests request
  where request.id = target_request_id
  for update;

  if current_request.id is null then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.request_assignments assignment
    where assignment.request_id = target_request_id
      and assignment.shopper_id = caller_id
      and assignment.released_at is null
  ) into caller_is_shopper;

  if not (
    (current_request.customer_id = caller_id and current_request.status in ('draft', 'open') and target_status = 'cancelled')
    or (caller_is_shopper and current_request.status = 'accepted' and target_status = 'shopping')
    or (caller_is_shopper and current_request.status = 'shopping' and target_status = 'delivering'
        and exists (select 1 from public.purchase_evidence evidence where evidence.request_id = target_request_id and evidence.kind = 'goods'))
    or (caller_is_shopper and current_request.status = 'delivering' and target_status = 'delivered'
        and exists (select 1 from public.purchase_evidence e where e.request_id = target_request_id and e.kind = 'delivery' and e.uploaded_by = caller_id))
    or (current_request.customer_id = caller_id and current_request.status = 'delivered' and target_status = 'completed')
    or ((current_request.customer_id = caller_id or caller_is_shopper)
        and current_request.status in ('accepted', 'shopping', 'delivering', 'delivered')
        and target_status = 'disputed')
  ) then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.shopping_requests request
  set status = target_status,
      completed_at = case when target_status = 'completed' then now() else request.completed_at end,
      cancelled_at = case when target_status = 'cancelled' then now() else request.cancelled_at end
  where request.id = target_request_id
  returning request.* into changed_request;

  if target_status = 'completed' then
    update public.request_assignments assignment
    set status = 'completed', completed_at = now()
    where assignment.request_id = target_request_id
      and assignment.released_at is null;
  end if;

  return changed_request;
end;
$$;

revoke execute on function public.transition_request(uuid, public.request_status) from public, anon;
grant execute on function public.transition_request(uuid, public.request_status) to authenticated;
