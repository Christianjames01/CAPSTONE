-- trigger_send_notification_email was SECURITY DEFINER without a pinned
-- search_path -- every call inside it was already schema-qualified
-- (net.http_post) or a pg_catalog builtin, so this wasn't concretely
-- exploitable, but every other SECURITY DEFINER function in this project
-- pins search_path and this one should too, for consistency and
-- defense-in-depth.
create or replace function public.trigger_send_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public, net, pg_temp
as $function$
begin
  perform net.http_post(
    url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '1bb062c2e1418c9dda92e6b8d9fe7449b5dc34b46a63039debc9ad75f7b96c44'
    ),
    body := jsonb_build_object('record', row_to_json(new)),
    timeout_milliseconds := 15000
  );
  return new;
end;
$function$;
