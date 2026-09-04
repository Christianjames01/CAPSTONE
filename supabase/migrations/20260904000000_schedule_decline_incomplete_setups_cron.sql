-- Accounts that sign in but never finish "Complete your profile" have no
-- student record, so they sat in the admin "Pending Setup" list forever
-- with no automatic follow-up. Runs daily at 23:50 UTC (07:50 Philippine
-- time), after the other daily jobs.
select cron.schedule(
    'decline-incomplete-setups-daily',
    '50 23 * * *',
    $$
    select net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/decline-incomplete-setups',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
    );
    $$
);
