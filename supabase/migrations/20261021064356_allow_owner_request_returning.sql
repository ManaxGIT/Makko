-- Check ownership directly so INSERT RETURNING can see the new row before
-- the stable participant helper's table snapshot includes it.
alter policy shopping_requests_select_participant on public.shopping_requests
using (
  (select auth.uid()) = customer_id
  or (select private.is_request_participant(id))
);
