-- Live updates on every page: add the remaining tables the portals show to
-- the supabase_realtime publication, so pages refresh on their own when
-- something changes (a new notification or message, a requirement being
-- reviewed, the queue moving, a document type or college being edited...).
--
-- Realtime still applies each table's RLS, so every user only hears about
-- rows they're allowed to see. The pages also re-check every minute and when
-- the tab is reopened, so nothing breaks if a table is missing here.
--
-- Safe to re-run: tables already in the publication (or not present) are
-- skipped.

do $$
declare
    t text;
begin
    foreach t in array array[
        'document_requests', 'claim_schedules', 'official_receipts',
        'notifications', 'messages', 'walk_in_queue',
        'request_requirements', 'credentials', 'request_ratings',
        'announcements', 'document_types', 'document_requirements',
        'colleges', 'programs', 'students', 'employees', 'employee_assignments',
        'activity_logs', 'office_events', 'office_open_days', 'profiles'
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
