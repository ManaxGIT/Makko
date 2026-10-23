-- Reviews are immutable. Only the RPC may insert and maintain reputation.
drop policy reviews_insert_completed_participant on public.reviews;
revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to service_role;

create or replace function private.submit_order_review(
  target_request_id uuid, review_rating integer, review_comment text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid(); r public.shopping_requests; a public.request_assignments;
  recipient uuid; saved public.reviews; normalized text := nullif(btrim(review_comment),'');
begin
  if caller is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into r from public.shopping_requests where id=target_request_id for update;
  select * into a from public.request_assignments where request_id=target_request_id and released_at is null;
  if r.id is null or a.id is null or caller not in (r.customer_id,a.shopper_id) then
    raise exception 'review_not_found' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=caller and account_status='active') then
    raise exception 'active_profile_required' using errcode='42501';
  end if;
  if r.status<>'completed' then raise exception 'review_not_completed'; end if;
  if review_rating is null or review_rating not between 1 and 5 or char_length(review_comment)>1000 then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  recipient := case when caller=r.customer_id then a.shopper_id else r.customer_id end;
  select * into saved from public.reviews where request_id=r.id and reviewer_id=caller and reviewee_id=recipient;
  if saved.id is not null then
    -- Identical retry after a lost response returns the original review, never a second insert.
    if saved.rating<>review_rating or saved.comment is distinct from normalized then
      raise exception 'review_already_submitted';
    end if;
    return to_jsonb(saved);
  end if;
  -- Serialize different orders rating the same account before computing its aggregate.
  perform 1 from public.profiles where id=recipient for update;
  insert into public.reviews(request_id,reviewer_id,reviewee_id,rating,comment)
    values(r.id,caller,recipient,review_rating,normalized) returning * into saved;
  update public.profiles set
    average_rating=(select round(avg(rating),2) from public.reviews where reviewee_id=recipient),
    rating_count=(select count(*) from public.reviews where reviewee_id=recipient)
    where id=recipient;
  return to_jsonb(saved);
end $$;
revoke all on function private.submit_order_review(uuid,integer,text) from public,anon;
grant execute on function private.submit_order_review(uuid,integer,text) to authenticated;
create or replace function public.submit_order_review(
  target_request_id uuid, review_rating integer, review_comment text default null
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.submit_order_review(target_request_id,review_rating,review_comment);
$$;
revoke all on function public.submit_order_review(uuid,integer,text) from public,anon;
grant execute on function public.submit_order_review(uuid,integer,text) to authenticated;

-- Existing reviews, if any, remain the source of truth for reputation.
update public.profiles p set average_rating=s.average_rating,rating_count=s.rating_count
from (select reviewee_id,round(avg(rating),2) average_rating,count(*) rating_count
      from public.reviews group by reviewee_id) s where p.id=s.reviewee_id;
