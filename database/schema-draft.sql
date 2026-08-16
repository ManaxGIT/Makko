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

