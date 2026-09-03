-- Two low-severity findings from `supabase db advisors --type security`:
--
-- 1. Five trigger functions had no pinned search_path. None of them are
--    SECURITY DEFINER (they run as the caller, not elevated), so this
--    isn't the classic schema-hijack risk -- but every other function in
--    this project pins search_path, so these five are brought in line for
--    consistency and defense-in-depth.
--
-- 2. Eight SECURITY DEFINER trigger functions (return type `trigger`) had
--    EXECUTE still granted to anon/authenticated, which the advisor flags
--    as "callable via /rest/v1/rpc/...". In practice Postgres refuses to
--    invoke a trigger function outside trigger context, so this was never
--    actually exploitable -- but revoking the unused grant removes the
--    exposed RPC route entirely rather than relying on that refusal.
--    (Trigger firing itself doesn't require EXECUTE privilege, so this
--    doesn't affect the triggers still working.)

alter function public.update_updated_at_column() set search_path = public;
alter function public.generate_request_number() set search_path = public;
alter function public.generate_exit_slip_number() set search_path = public;
alter function public.set_request_number() set search_path = public;
alter function public.set_credential_number() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.notify_heads_of_pending_employee() from anon, authenticated;
revoke execute on function public.prevent_message_content_tampering() from anon, authenticated;
revoke execute on function public.prevent_profile_self_escalation() from anon, authenticated;
revoke execute on function public.prevent_receipt_self_verification() from anon, authenticated;
revoke execute on function public.prevent_requirement_self_approval() from anon, authenticated;
revoke execute on function public.prevent_student_self_approval() from anon, authenticated;
revoke execute on function public.trigger_send_notification_email() from anon, authenticated;
