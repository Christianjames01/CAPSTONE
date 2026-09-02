-- The pg_cron -> Edge Function webhook secret was committed in plaintext
-- across several earlier migrations (readable by anyone with repo access,
-- forever, in git history). Rotated the value and moved it into Supabase
-- Vault -- the secret itself now never appears in a migration file, this
-- one included; it's generated randomly and only ever lives encrypted in
-- vault.secrets / the WEBHOOK_SECRET Edge Function secret (kept in sync
-- manually after rotation).
--
-- On a fresh environment, running this migration creates a random secret
-- automatically. WEBHOOK_SECRET (the Edge Function env var each function
-- checks against) then needs to be set to match:
--   select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret';
--   supabase secrets set WEBHOOK_SECRET=<that value>

do $$
begin
    if not exists (select 1 from vault.secrets where name = 'webhook_secret') then
        perform vault.create_secret(
            encode(gen_random_bytes(32), 'hex'),
            'webhook_secret',
            'Shared secret for pg_cron and trigger_send_notification_email to authenticate calls to Edge Functions'
        );
    end if;
end;
$$;

create or replace function public.trigger_send_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $function$
declare
    v_secret text;
begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'webhook_secret';

    perform net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-notification-email',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body := jsonb_build_object('record', row_to_json(new)),
        timeout_milliseconds := 15000
    );
    return new;
end;
$function$;

select cron.alter_job(
    (select jobid from cron.job where jobname = 'send-claim-reminders-daily'),
    command := $cmd$
select net.http_post(
    url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-claim-reminders',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
);
$cmd$
);

select cron.alter_job(
    (select jobid from cron.job where jobname = 'send-registrar-alerts-daily'),
    command := $cmd$
select net.http_post(
    url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/send-registrar-alerts',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
);
$cmd$
);

select cron.alter_job(
    (select jobid from cron.job where jobname = 'mark-missed-claims-daily'),
    command := $cmd$
select net.http_post(
    url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/mark-missed-claims',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
);
$cmd$
);
