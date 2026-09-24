-- The Claim Schedule form now asks WHERE the student claims their document
-- (e.g. "Registrar Window 2") instead of an "estimated duration" that was
-- saved but never read or shown anywhere. The counter is shown to the
-- student with their schedule.
--
-- estimated_duration_minutes stays in the table (existing rows, and the app
-- still writes its old default) but is no longer shown.

alter table public.claim_schedules add column if not exists claiming_counter text;

notify pgrst, 'reload schema';
