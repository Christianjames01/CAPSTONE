-- login-guard: per-IP log of reported failed logins, so one person can't
-- lock other people out by reporting fake failures for their email.
-- Only the edge function (service role) uses it. Safe to re-run.

create table if not exists public.login_guard_attempts (
    attempt_id bigint generated always as identity primary key,
    ip_address text not null,
    created_at timestamptz not null default now()
);

create index if not exists login_guard_attempts_ip_idx
    on public.login_guard_attempts (ip_address, created_at desc);

alter table public.login_guard_attempts enable row level security;
-- No policies: only the service role (edge function) can read or write.
revoke all on public.login_guard_attempts from anon, authenticated;

-- Keep it small: drop entries older than a day, hourly.
do $$
begin
    if exists (select 1 from cron.job where jobname = 'cleanup-login-guard-attempts') then
        perform cron.unschedule('cleanup-login-guard-attempts');
    end if;
end;
$$;

select cron.schedule(
    'cleanup-login-guard-attempts',
    '40 * * * *',
    $$ delete from public.login_guard_attempts where created_at < now() - interval '1 day'; $$
);
