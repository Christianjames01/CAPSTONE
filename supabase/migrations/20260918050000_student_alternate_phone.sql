-- A second, alternative phone number for a student (separate from their
-- account phone_number on profiles and from emergency_contact_number,
-- which is someone else's number) -- e.g. a backup line the registrar can
-- try if the student's main number is unreachable.
alter table public.students
    add column if not exists alternate_phone_number character varying;
