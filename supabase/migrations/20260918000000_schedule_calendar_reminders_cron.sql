-- Warns staff (employees, registrar heads, admins) ahead of an upcoming
-- Office Calendar event (e.g. "Mental Health Break", a fiesta closure) with
-- an in-app notification and an email, both including a day-count (3 days
-- out, then again the day before), so nobody is caught off guard by
-- something that was added weeks in advance. See
-- supabase/functions/send-calendar-reminders. Runs daily at 22:45 UTC
-- (06:45 Philippine time), just before the claim-reminders job.
select cron.schedule(
    'send-calendar-reminders-daily',
    '45 22 * * *',
    $$
    select net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-calendar-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
    );
    $$
);
