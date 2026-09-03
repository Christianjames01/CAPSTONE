-- Follow-up to 20260903130000: revoking EXECUTE from anon/authenticated
-- directly was a no-op -- these 8 functions were never granted EXECUTE
-- directly to anon/authenticated, only implicitly via the default PUBLIC
-- grant every function gets on creation (visible in pg_proc.proacl as the
-- `=X` entry). Revoking from PUBLIC is what actually removes anon's and
-- authenticated's ability to call them.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.notify_heads_of_pending_employee() from public;
revoke execute on function public.prevent_message_content_tampering() from public;
revoke execute on function public.prevent_profile_self_escalation() from public;
revoke execute on function public.prevent_receipt_self_verification() from public;
revoke execute on function public.prevent_requirement_self_approval() from public;
revoke execute on function public.prevent_student_self_approval() from public;
revoke execute on function public.trigger_send_notification_email() from public;
