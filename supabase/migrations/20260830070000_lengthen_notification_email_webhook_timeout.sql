-- pg_net's default 5s timeout was too short for an SMTP round-trip
-- (Gmail SMTP + a cold Edge Function start can take longer than a typical
-- webhook), so notification emails triggered by real inserts were timing
-- out even though the function itself works. 15s gives it enough room.
create or replace function trigger_send_notification_email()
returns trigger
language plpgsql
security definer
as $$
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
$$;
