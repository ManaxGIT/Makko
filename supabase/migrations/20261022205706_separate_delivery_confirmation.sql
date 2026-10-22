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
    or (caller_is_shopper and current_request.status = 'delivering' and target_status = 'delivered')
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
