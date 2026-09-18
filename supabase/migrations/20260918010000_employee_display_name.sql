-- Lets an employee have a nickname/display name shown to students in
-- Messages, instead of their real first/last name from `profiles`. Optional
-- -- when blank, everything falls back to the real name exactly as before.
alter table public.employees
    add column if not exists display_name text;
