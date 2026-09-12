create type public.payment_method as enum (
  'cash',
  'bank_transfer'
);

alter table public.shopping_requests
  add column payment_method public.payment_method not null default 'cash';
