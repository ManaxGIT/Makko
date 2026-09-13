create or replace function public.release_accepted_request(target_request_id uuid)
returns public.shopping_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  released_request public.shopping_requests;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform 1
  from public.shopping_requests request
  where request.id = target_request_id
    and request.status = 'accepted'
  for update;

  if not found then
    raise exception 'request_not_releasable' using errcode = 'P0001';
  end if;

  update public.request_assignments assignment
  set status = 'released',
      released_at = now(),
      release_reason = 'shopper_cancelled'
  where assignment.request_id = target_request_id
    and assignment.shopper_id = caller_id
    and assignment.status = 'active'
    and assignment.released_at is null;

  if not found then
    raise exception 'active_assignment_not_found' using errcode = 'P0001';
  end if;

  update public.shopping_requests request
  set status = 'open'
  where request.id = target_request_id
  returning request.* into released_request;

  return released_request;
end;
$$;

revoke execute on function public.release_accepted_request(uuid) from public, anon;
grant execute on function public.release_accepted_request(uuid) to authenticated;
