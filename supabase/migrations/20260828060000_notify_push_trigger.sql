-- Mirrors trigger_send_notification_email(): fires the new
-- send-push-notification Edge Function on every notifications INSERT,
-- using the same shared webhook secret gate.
create or replace function public.trigger_send_push_notification()
returns trigger
language plpgsql
security definer
as $function$
begin
  perform net.http_post(
    url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '1bb062c2e1418c9dda92e6b8d9fe7449b5dc34b46a63039debc9ad75f7b96c44'
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$function$;

create trigger on_notification_insert_push
after insert on public.notifications
for each row execute function public.trigger_send_push_notification();
