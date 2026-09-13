-- Read-oriented application APIs now live in apps/api. Remove the temporary
-- public RPC surface while preserving transactional workflow RPCs.
drop function if exists public.get_home_dashboard(double precision, double precision, integer);
drop function if exists public.list_explore_requests(text, double precision, double precision, integer);
drop function if exists public.list_my_orders(integer);
drop function if exists public.get_public_profile(uuid);
drop function if exists public.list_open_requests(integer);
