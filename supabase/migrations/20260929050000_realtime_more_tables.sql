-- More tables in the supabase_realtime publication so pages update live:
-- reschedule requests (claim schedule pages), plus the representative and
-- note tables in case their own migrations ran before realtime was set up.
--
-- Realtime still applies each table's RLS. Safe to re-run.

do $$
declare
    t text;
begin
    foreach t in array array[
        'claim_reschedule_requests', 'claim_representatives', 'request_notes', 'message_hidden'
    ] loop
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
