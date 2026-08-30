-- send-claim-reminders existed and worked when invoked manually, but was
-- never actually wired to a schedule -- pg_cron wasn't even enabled, so
-- the "runs once a day" reminder email never once fired on its own.
-- Runs daily at 23:00 UTC (07:00 Philippine time).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
    'send-claim-reminders-daily',
    '0 23 * * *',
    $$
    select net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-claim-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', '1bb062c2e1418c9dda92e6b8d9fe7449b5dc34b46a63039debc9ad75f7b96c44'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
    );
    $$
);
