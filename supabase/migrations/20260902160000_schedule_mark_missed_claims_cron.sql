-- A claim schedule whose date passed while still "scheduled" meant the
-- student never showed up, but nothing flagged it -- the request just sat
-- indefinitely with no signal to the student or the employee. Runs daily
-- at 23:45 UTC (07:45 Philippine time), after the other daily jobs.
select cron.schedule(
    'mark-missed-claims-daily',
    '45 23 * * *',
    $$
    select net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/mark-missed-claims',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', '1bb062c2e1418c9dda92e6b8d9fe7449b5dc34b46a63039debc9ad75f7b96c44'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
    );
    $$
);
