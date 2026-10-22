-- Commit the enum addition before any function uses the new value.
alter type public.request_status add value if not exists 'delivered' before 'completed';
