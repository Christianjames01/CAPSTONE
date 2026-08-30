-- The view inherited Supabase's default "grant all" schema privileges for
-- anon/authenticated. It isn't actually writable (it joins 6 tables), but
-- revoke the write grants explicitly so only SELECT is ever possible.
revoke all on public_credential_verification from anon, authenticated;
grant select on public_credential_verification to anon, authenticated;
