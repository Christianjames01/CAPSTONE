-- Daily digest to registrar heads/admins about requests stuck 2+ days in an
-- in-progress status, or left with no employee assigned at all. Runs daily
-- at 23:30 UTC (07:30 Philippine time), just after the claim-reminders job.
select cron.schedule(
    'send-registrar-alerts-daily',
    '30 23 * * *',
    $$
    select net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-registrar-alerts',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', '1bb062c2e1418c9dda92e6b8d9fe7449b5dc34b46a63039debc9ad75f7b96c44'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
    );
    $$
);
