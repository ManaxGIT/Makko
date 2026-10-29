-- A proposal records the customer's confirmation. The assigned shopper alone responds.
create table public.goods_amount_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shopping_requests(id) on delete cascade,
  assignment_id uuid not null references public.request_assignments(id) on delete cascade,
  old_amount numeric(12,2),
  new_amount numeric(12,2) not null check(new_amount > 0),
  status text not null default 'pending' check(status in ('pending','accepted','rejected','expired')),
  created_at timestamptz not null default clock_timestamp(),
  responded_at timestamptz
);
create unique index goods_amount_one_pending on public.goods_amount_proposals(request_id) where status='pending';
create index goods_amount_assignment_latest on public.goods_amount_proposals(assignment_id,created_at desc,id desc);
alter table public.goods_amount_proposals enable row level security;
revoke all on public.goods_amount_proposals from public,anon,authenticated;
grant select on public.goods_amount_proposals to service_role;

-- Existing release/status/evidence RPCs already lock this same request row.
-- Leaving the two eligible stages expires pending consent in that transaction.
create function private.expire_goods_amount_proposals() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status not in ('accepted','shopping') then
    update public.goods_amount_proposals set status='expired',responded_at=now()
      where request_id=new.id and status='pending';
  end if;
  return new;
end $$;
revoke all on function private.expire_goods_amount_proposals() from public,anon,authenticated;
create trigger expire_goods_amount_proposals after update of status on public.shopping_requests
for each row when(old.status is distinct from new.status) execute function private.expire_goods_amount_proposals();

create function private.get_goods_amount_agreement(target_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid(); r public.shopping_requests; a public.request_assignments;
  p public.goods_amount_proposals;
begin
  if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
  -- SHARE also makes a read of money and pending consent a coherent snapshot.
  select * into r from public.shopping_requests where id=target_request_id for share;
  select * into a from public.request_assignments where request_id=target_request_id and released_at is null;
  if r.id is null or (caller<>r.customer_id and (a.id is null or caller<>a.shopper_id)) then
    raise exception 'agreement_not_found' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=caller and account_status='active') then
    raise exception 'active_profile_required' using errcode='42501';
  end if;
  select * into p from public.goods_amount_proposals where assignment_id=a.id order by created_at desc,id desc limit 1;
  return jsonb_build_object('request_id',r.id,'role',case when caller=r.customer_id then 'customer' else 'shopper' end,
    'status',r.status,'currency',r.currency,'agreed_amount',r.estimated_items_total,'delivery_fee',r.delivery_fee,
    'can_propose',caller=r.customer_id and a.id is not null and r.status in ('accepted','shopping') and (p.id is null or p.status<>'pending'),
    'proposal',case when p.id is null then null else to_jsonb(p) end);
end $$;

create function private.propose_goods_amount(target_request_id uuid,new_goods_amount numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.shopping_requests; a public.request_assignments; p public.goods_amount_proposals;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into r from public.shopping_requests where id=target_request_id for update;
  if r.id is null or r.customer_id<>auth.uid() then raise exception 'agreement_not_found' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then
    raise exception 'active_profile_required' using errcode='42501'; end if;
  select * into a from public.request_assignments where request_id=r.id and released_at is null;
  if r.status not in ('accepted','shopping') or a.id is null then raise exception 'agreement_stage_closed'; end if;
  if new_goods_amount is null or new_goods_amount::text in ('NaN','Infinity','-Infinity')
    or new_goods_amount<=0 or new_goods_amount>9999999999.99 or round(new_goods_amount,2)<>new_goods_amount
    or new_goods_amount is not distinct from r.estimated_items_total then
    raise exception 'invalid_goods_amount' using errcode='22023'; end if;
  select * into p from public.goods_amount_proposals where request_id=r.id and status='pending';
  if p.id is not null then
    if p.assignment_id<>a.id or p.new_amount<>new_goods_amount then raise exception 'agreement_pending'; end if;
    return private.get_goods_amount_agreement(r.id);
  end if;
  insert into public.goods_amount_proposals(request_id,assignment_id,old_amount,new_amount)
    values(r.id,a.id,r.estimated_items_total,new_goods_amount);
  return private.get_goods_amount_agreement(r.id);
end $$;

create function private.respond_goods_amount(target_request_id uuid,target_proposal_id uuid,accept_proposal boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.shopping_requests; a public.request_assignments; p public.goods_amount_proposals;
  decision text := case when accept_proposal then 'accepted' else 'rejected' end;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into r from public.shopping_requests where id=target_request_id for update;
  select * into a from public.request_assignments where request_id=target_request_id and released_at is null;
  if r.id is null or a.id is null or a.shopper_id<>auth.uid() then raise exception 'agreement_not_found' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then
    raise exception 'active_profile_required' using errcode='42501'; end if;
  select * into p from public.goods_amount_proposals where id=target_proposal_id and request_id=r.id and assignment_id=a.id;
  if p.id is null then raise exception 'agreement_not_found' using errcode='42501'; end if;
  if accept_proposal is null then raise exception 'invalid_agreement_response' using errcode='22023'; end if;
  if p.status=decision then return private.get_goods_amount_agreement(r.id); end if;
  if p.status<>'pending' then raise exception 'agreement_already_resolved'; end if;
  if r.status not in ('accepted','shopping') then raise exception 'agreement_stage_closed'; end if;
  if r.estimated_items_total is distinct from p.old_amount then raise exception 'agreement_amount_changed'; end if;
  update public.goods_amount_proposals set status=decision,responded_at=now() where id=p.id;
  if accept_proposal then
    update public.shopping_requests set estimated_items_total=p.new_amount where id=r.id;
  end if;
  return private.get_goods_amount_agreement(r.id);
end $$;

revoke all on function private.get_goods_amount_agreement(uuid),private.propose_goods_amount(uuid,numeric),private.respond_goods_amount(uuid,uuid,boolean) from public,anon;
grant execute on function private.get_goods_amount_agreement(uuid),private.propose_goods_amount(uuid,numeric),private.respond_goods_amount(uuid,uuid,boolean) to authenticated;
create function public.get_goods_amount_agreement(target_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_goods_amount_agreement(target_request_id); $$;
create function public.propose_goods_amount(target_request_id uuid,new_goods_amount numeric) returns jsonb
language sql security invoker set search_path='' as $$ select private.propose_goods_amount(target_request_id,new_goods_amount); $$;
create function public.respond_goods_amount(target_request_id uuid,target_proposal_id uuid,accept_proposal boolean) returns jsonb
language sql security invoker set search_path='' as $$ select private.respond_goods_amount(target_request_id,target_proposal_id,accept_proposal); $$;
revoke all on function public.get_goods_amount_agreement(uuid),public.propose_goods_amount(uuid,numeric),public.respond_goods_amount(uuid,uuid,boolean) from public,anon;
grant execute on function public.get_goods_amount_agreement(uuid),public.propose_goods_amount(uuid,numeric),public.respond_goods_amount(uuid,uuid,boolean) to authenticated;
