-- Makko MVP access control, triggers and transactional RPCs.
-- Applied together with schema-draft.sql in the initial migration.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- New objects are private by default; each API object is granted explicitly below.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function private.set_updated_at();

create trigger shopping_requests_set_updated_at
before update on public.shopping_requests
for each row execute function private.set_updated_at();

create trigger receipts_set_updated_at
before update on public.receipts
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_path, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Người dùng Makko'),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated, service_role;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_request_participant(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.shopping_requests request
    where request.id = target_request_id
      and (
        request.customer_id = (select auth.uid())
        or exists (
          select 1
          from public.request_assignments assignment
          where assignment.request_id = request.id
            and assignment.shopper_id = (select auth.uid())
            and assignment.released_at is null
        )
      )
  );
$$;

create or replace function private.owns_editable_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.shopping_requests request
    where request.id = target_request_id
      and request.customer_id = (select auth.uid())
      and request.status in ('draft', 'open')
  );
$$;

create or replace function private.is_active_shopper(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.request_assignments assignment
    where assignment.request_id = target_request_id
      and assignment.shopper_id = (select auth.uid())
      and assignment.released_at is null
  );
$$;

revoke execute on function private.is_request_participant(uuid) from public, anon, authenticated, service_role;
revoke execute on function private.owns_editable_request(uuid) from public, anon, authenticated, service_role;
revoke execute on function private.is_active_shopper(uuid) from public, anon, authenticated, service_role;

create or replace function private.log_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.request_status_history (
      request_id, from_status, to_status, actor_id
    ) values (
      new.id, old.status, new.status, (select auth.uid())
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.log_request_status_change() from public, anon, authenticated, service_role;

create trigger shopping_requests_log_status
after update of status on public.shopping_requests
for each row execute function private.log_request_status_change();

-- Profiles: a user can read and edit only their complete profile. Public profile
-- fields are provided by get_public_profile() without exposing phone numbers.
create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy addresses_all_own
on public.addresses for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy shopping_requests_select_participant
on public.shopping_requests for select to authenticated
using ((select private.is_request_participant(id)));

create policy shopping_requests_insert_customer
on public.shopping_requests for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and status = 'draft'
);

create policy shopping_requests_update_customer_editable
on public.shopping_requests for update to authenticated
using (
  (select auth.uid()) = customer_id
  and status in ('draft', 'open')
)
with check (
  (select auth.uid()) = customer_id
  and status in ('draft', 'open')
);

create policy request_items_select_participant
on public.request_items for select to authenticated
using ((select private.is_request_participant(request_id)));

create policy request_items_insert_owner
on public.request_items for insert to authenticated
with check ((select private.owns_editable_request(request_id)));

create policy request_items_update_owner
on public.request_items for update to authenticated
using ((select private.owns_editable_request(request_id)))
with check ((select private.owns_editable_request(request_id)));

create policy request_items_delete_owner
on public.request_items for delete to authenticated
using ((select private.owns_editable_request(request_id)));

create policy request_images_select_participant
on public.request_images for select to authenticated
using ((select private.is_request_participant(request_id)));

create policy request_images_insert_participant
on public.request_images for insert to authenticated
with check (
  (select auth.uid()) = uploaded_by
  and (
    (select private.owns_editable_request(request_id))
    or (select private.is_active_shopper(request_id))
  )
);

create policy request_images_delete_uploader
on public.request_images for delete to authenticated
using ((select auth.uid()) = uploaded_by);

create policy request_assignments_select_participant
on public.request_assignments for select to authenticated
using ((select private.is_request_participant(request_id)));

create policy request_status_history_select_participant
on public.request_status_history for select to authenticated
using ((select private.is_request_participant(request_id)));

create policy messages_select_participant
on public.messages for select to authenticated
using ((select private.is_request_participant(request_id)));

create policy messages_insert_participant
on public.messages for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and (select private.is_request_participant(request_id))
);

create policy receipts_select_participant
on public.receipts for select to authenticated
using ((select private.is_request_participant(request_id)));

create policy receipts_insert_shopper
on public.receipts for insert to authenticated
with check (
  (select auth.uid()) = uploaded_by
  and (select private.is_active_shopper(request_id))
);

create policy receipts_update_shopper
on public.receipts for update to authenticated
using (
  (select auth.uid()) = uploaded_by
  and (select private.is_active_shopper(request_id))
)
with check (
  (select auth.uid()) = uploaded_by
  and (select private.is_active_shopper(request_id))
);

create policy reviews_select_authenticated
on public.reviews for select to authenticated
using (true);

create policy reviews_insert_completed_participant
on public.reviews for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and reviewer_id <> reviewee_id
  and exists (
    select 1
    from public.shopping_requests request
    join public.request_assignments assignment
      on assignment.request_id = request.id
    where request.id = reviews.request_id
      and request.status = 'completed'
      and (
        (request.customer_id = reviews.reviewer_id and assignment.shopper_id = reviews.reviewee_id)
        or
        (assignment.shopper_id = reviews.reviewer_id and request.customer_id = reviews.reviewee_id)
      )
  )
);

create policy notifications_select_own
on public.notifications for select to authenticated
using ((select auth.uid()) = recipient_id);

create policy notifications_update_own
on public.notifications for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

-- Explicit least-privilege Data API grants.
grant select, update (display_name, avatar_path, phone, bio) on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert,
  update (title, description, estimated_items_total, delivery_fee, deliver_by,
          source_address_id, delivery_recipient_name, delivery_phone,
          delivery_line1, delivery_line2, delivery_ward, delivery_district,
          delivery_city, delivery_latitude, delivery_longitude, delivery_note)
  on public.shopping_requests to authenticated;
grant select, insert, update, delete on public.request_items to authenticated;
grant select, insert, delete on public.request_images to authenticated;
grant select on public.request_assignments to authenticated;
grant select on public.request_status_history to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.receipts to authenticated;
grant select, insert on public.reviews to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant usage, select on sequence public.messages_id_seq to authenticated;

-- Safe public-profile lookup without exposing contact details.
create or replace function public.get_public_profile(target_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  bio text,
  average_rating numeric,
  rating_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_path, p.bio,
         p.average_rating, p.rating_count, p.created_at
  from public.profiles p
  where p.id = target_user_id
    and p.account_status = 'active';
$$;

-- Discovery endpoint intentionally excludes exact address and phone.
create or replace function public.list_open_requests(result_limit integer default 20)
returns table (
  id uuid,
  customer_id uuid,
  title text,
  description text,
  currency char(3),
  estimated_items_total numeric,
  delivery_fee numeric,
  deliver_by timestamptz,
  delivery_ward text,
  delivery_district text,
  delivery_city text,
  published_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select request.id, request.customer_id, request.title, request.description,
         request.currency, request.estimated_items_total, request.delivery_fee,
         request.deliver_by, request.delivery_ward, request.delivery_district,
         request.delivery_city, request.published_at, request.created_at
  from public.shopping_requests request
  join public.profiles customer on customer.id = request.customer_id
  where (select auth.uid()) is not null
    and request.status = 'open'
    and customer.account_status = 'active'
  order by request.created_at desc
  limit least(greatest(coalesce(result_limit, 20), 1), 100);
$$;

create or replace function public.publish_request(target_request_id uuid)
returns public.shopping_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_request public.shopping_requests;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.request_items item
    where item.request_id = target_request_id
  ) then
    raise exception 'request_requires_at_least_one_item' using errcode = '23514';
  end if;

  update public.shopping_requests request
  set status = 'open', published_at = now()
  where request.id = target_request_id
    and request.customer_id = (select auth.uid())
    and request.status = 'draft'
    and request.deliver_by > now()
  returning request.* into published_request;

  if published_request.id is null then
    raise exception 'request_not_publishable' using errcode = 'P0001';
  end if;

  return published_request;
end;
$$;

create or replace function public.accept_request(target_request_id uuid)
returns public.request_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_assignment public.request_assignments;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.shopping_requests request
  set status = 'accepted'
  where request.id = target_request_id
    and request.status = 'open'
    and request.customer_id <> (select auth.uid());

  if not found then
    raise exception 'request_not_available' using errcode = 'P0001';
  end if;

  insert into public.request_assignments (request_id, shopper_id)
  values (target_request_id, (select auth.uid()))
  returning * into accepted_assignment;

  return accepted_assignment;
end;
$$;

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
        and exists (select 1 from public.receipts receipt where receipt.request_id = target_request_id))
    or (current_request.customer_id = caller_id and current_request.status = 'delivering' and target_status = 'completed')
    or ((current_request.customer_id = caller_id or caller_is_shopper)
        and current_request.status in ('accepted', 'shopping', 'delivering')
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

revoke execute on function public.get_public_profile(uuid) from public, anon;
revoke execute on function public.list_open_requests(integer) from public, anon;
revoke execute on function public.publish_request(uuid) from public, anon;
revoke execute on function public.accept_request(uuid) from public, anon;
revoke execute on function public.transition_request(uuid, public.request_status) from public, anon;

grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.list_open_requests(integer) to authenticated;
grant execute on function public.publish_request(uuid) to authenticated;
grant execute on function public.accept_request(uuid) to authenticated;
grant execute on function public.transition_request(uuid, public.request_status) to authenticated;
