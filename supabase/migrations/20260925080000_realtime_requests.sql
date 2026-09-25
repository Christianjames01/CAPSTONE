-- Live updates: request lists and dashboards refresh on their own when a
-- request, claiming schedule or receipt changes (e.g. a student submits a
-- new request), instead of waiting for someone to reload the page.
--
-- Supabase Realtime only sends changes for tables in the supabase_realtime
-- publication. It still applies each table's RLS, so every user only hears
-- about rows they're allowed to see.
--
-- Safe to re-run: tables already in the publication are skipped.

do $$
declare
    t text;
begin
    foreach t in array array['document_requests', 'claim_schedules', 'official_receipts'] loop
        if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
           and not exists (
               select 1 from pg_publication_tables
               where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
           )
        then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end;
$$;
