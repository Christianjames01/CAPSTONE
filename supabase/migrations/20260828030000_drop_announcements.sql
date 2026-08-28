-- Reverts the announcements feature (see 20260828020000_add_announcements.sql).
-- Dropping the table also drops its RLS policies automatically.

drop table if exists public.announcements;

-- Clean up the notification rows the feature bulk-created when an
-- announcement was posted, so no orphaned "announcement" notifications
-- remain once the feature itself is gone.
delete from public.notifications where notification_type = 'announcement';
