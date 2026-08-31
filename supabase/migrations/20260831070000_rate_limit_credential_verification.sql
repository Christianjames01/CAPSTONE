-- public_credential_verification was directly SELECT-able by anon and
-- authenticated. Credential numbers are now short and sequential
-- (CERT-000123), so that view was fully enumerable -- a script could walk
-- CERT-000001, CERT-000002, ... and harvest every graduate's full name,
-- college, and program with no rate limit at all.
--
-- Lock the view down to service-role-only and route all lookups through
-- the new verify-credential Edge Function, which rate-limits by IP.

revoke select on public.public_credential_verification from anon;
revoke select on public.public_credential_verification from authenticated;

create table if not exists public.credential_verification_attempts (
    attempt_id uuid primary key default gen_random_uuid(),
    ip_address text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_credential_verification_attempts_ip_time
    on public.credential_verification_attempts (ip_address, created_at);

alter table public.credential_verification_attempts enable row level security;
-- No policies: only the service role (used by the Edge Function) can
-- read/write this table. That's intentional -- it's rate-limiting
-- bookkeeping, not something any client should touch directly.
