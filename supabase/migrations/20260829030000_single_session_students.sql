-- Backs the "only one device logged in at a time" restriction for
-- students: each login writes a fresh random id here and to the
-- browser's localStorage; other open sessions watch this column via
-- Realtime and sign themselves out when it changes to something else.
alter table public.profiles
add column active_session_id uuid;

-- Needed for the client to receive postgres_changes UPDATE events on
-- this table (existing RLS SELECT policies still gate who sees what).
alter publication supabase_realtime add table public.profiles;
