-- Backs brute-force protection on password login: failed_login_attempts
-- increments on each wrong password, and once it hits the threshold (set
-- in the login-guard Edge Function), locked_until is set and login is
-- refused until that time passes. Both are only ever written by that
-- Edge Function (via the service role, bypassing RLS), since a failed
-- login attempt happens before the browser has an authenticated session
-- to write with.
alter table public.profiles
add column failed_login_attempts integer not null default 0,
add column locked_until timestamptz;
