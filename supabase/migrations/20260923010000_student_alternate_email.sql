-- A personal, non-HCDC email students can put on file so they still have a
-- way to log in after their hcdc.edu.ph account gets deactivated post-
-- graduation. Separate from alternate_phone_number's precedent -- this one
-- also gets offered as the pre-filled target when a student uses the
-- self-serve Change Email flow to move their login off their HCDC address.
alter table public.students
    add column if not exists alternate_email character varying;
