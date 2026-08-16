-- Makko MVP schema draft.
-- This is a reviewable design artifact, not an applied Supabase migration.
-- Generate the real migration with: supabase migration new init_makko_mvp

create extension if not exists pgcrypto;

create type public.request_status as enum (
  'draft', 'open', 'accepted', 'shopping',
  'delivering', 'completed', 'cancelled', 'disputed'
);

create type public.assignment_status as enum ('active', 'released', 'completed');
create type public.account_status as enum ('active', 'suspended', 'deleted');
create type public.image_kind as enum ('item', 'reference', 'receipt');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_path text,
  phone text,
  bio text check (bio is null or char_length(bio) <= 500),
  account_status public.account_status not null default 'active',
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  rating_count bigint not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  recipient_name text not null,
  recipient_phone text not null,
  line1 text not null,
  line2 text,
  ward text,
  district text,
  city text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  delivery_note text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index addresses_one_default_per_owner_idx
  on public.addresses (owner_id) where is_default;
create index addresses_owner_id_idx on public.addresses (owner_id);

create table public.shopping_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  source_address_id uuid references public.addresses (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 2000),
  status public.request_status not null default 'draft',
  currency char(3) not null default 'VND',
  estimated_items_total numeric(12,2) check (estimated_items_total is null or estimated_items_total >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  actual_items_total numeric(12,2) check (actual_items_total is null or actual_items_total >= 0),
  deliver_by timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  delivery_recipient_name text not null,
  delivery_phone text not null,
  delivery_line1 text not null,
  delivery_line2 text,
  delivery_ward text,
  delivery_district text,
  delivery_city text not null,
  delivery_latitude double precision not null check (delivery_latitude between -90 and 90),
  delivery_longitude double precision not null check (delivery_longitude between -180 and 180),
  delivery_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deliver_by is null or deliver_by > created_at),
  check ((status <> 'completed') or completed_at is not null),
  check ((status <> 'cancelled') or cancelled_at is not null)
);

create index shopping_requests_customer_created_idx
  on public.shopping_requests (customer_id, created_at desc);
create index shopping_requests_open_created_idx
  on public.shopping_requests (created_at desc) where status = 'open';
create index shopping_requests_source_address_id_idx
  on public.shopping_requests (source_address_id) where source_address_id is not null;

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shopping_requests (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  quantity numeric(10,3) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 30),
  estimated_unit_price numeric(12,2) check (estimated_unit_price is null or estimated_unit_price >= 0),
  note text check (note is null or char_length(note) <= 500),
  allow_substitution boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (request_id, sort_order)
);

create index request_items_request_id_idx on public.request_items (request_id);

create table public.request_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shopping_requests (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  kind public.image_kind not null default 'reference',
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create index request_images_request_id_idx on public.request_images (request_id);
create index request_images_uploaded_by_idx on public.request_images (uploaded_by);

create table public.request_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shopping_requests (id) on delete restrict,
  shopper_id uuid not null references public.profiles (id) on delete restrict,
  status public.assignment_status not null default 'active',
  accepted_at timestamptz not null default now(),
  released_at timestamptz,
  completed_at timestamptz,
  release_reason text,
  check ((status = 'active' and released_at is null) or status <> 'active')
);

create unique index request_assignments_one_active_per_request_idx
  on public.request_assignments (request_id) where released_at is null;
create index request_assignments_request_id_idx on public.request_assignments (request_id);
create index request_assignments_shopper_accepted_idx
  on public.request_assignments (shopper_id, accepted_at desc);

create table public.request_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.shopping_requests (id) on delete restrict,
  from_status public.request_status,
  to_status public.request_status not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (from_status is distinct from to_status)
);

create index request_status_history_request_created_idx
  on public.request_status_history (request_id, created_at, id);
create index request_status_history_actor_id_idx
  on public.request_status_history (actor_id) where actor_id is not null;

create table public.messages (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.shopping_requests (id) on delete restrict,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_request_created_idx
  on public.messages (request_id, created_at, id);
create index messages_sender_id_idx on public.messages (sender_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.shopping_requests (id) on delete restrict,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique,
  merchant_name text,
  purchased_at timestamptz,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  currency char(3) not null default 'VND',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index receipts_uploaded_by_idx on public.receipts (uploaded_by);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shopping_requests (id) on delete restrict,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  reviewee_id uuid not null references public.profiles (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id),
  unique (request_id, reviewer_id, reviewee_id)
);

create index reviews_reviewee_created_idx on public.reviews (reviewee_id, created_at desc);
create index reviews_reviewer_id_idx on public.reviews (reviewer_id);

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (recipient_id, created_at desc) where read_at is null;

-- All tables in public are exposed-schema candidates. Deny by default until
-- explicit per-operation policies and grants are added in the real migration.
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.shopping_requests enable row level security;
alter table public.request_items enable row level security;
alter table public.request_images enable row level security;
alter table public.request_assignments enable row level security;
alter table public.request_status_history enable row level security;
alter table public.messages enable row level security;
alter table public.receipts enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

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

