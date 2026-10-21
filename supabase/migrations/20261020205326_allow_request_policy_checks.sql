-- These private, auth.uid()-scoped boolean helpers are referenced by the existing
-- RLS policies. Invoker transactions need EXECUTE to evaluate those policies.
-- They remain outside the exposed public API schema; anonymous access stays revoked.
grant execute on function private.is_request_participant(uuid) to authenticated;
grant execute on function private.owns_editable_request(uuid) to authenticated;
