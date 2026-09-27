-- 1) Alumni requests: graduates who aren't enrolled anymore register with
--    their graduation year instead of a year level. The registrar head
--    verifies them against records through the usual student verification.
-- 2) Requesting several documents at once: requests submitted together
--    share a batch_id, so the student pays one total at the Finance Office
--    and can upload one official receipt for all of them. Each document is
--    still its own request, tracked separately.
--
-- Safe to re-run.

alter table public.students
    add column if not exists student_type text not null default 'current';

alter table public.students
    add column if not exists graduation_year integer;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'students_student_type_check'
    ) then
        alter table public.students
            add constraint students_student_type_check check (student_type in ('current', 'alumni'));
    end if;

    -- graduation_year may already exist with another type; only range-check
    -- it when it is numeric.
    if not exists (
        select 1 from pg_constraint where conname = 'students_graduation_year_check'
    ) and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'students'
          and column_name = 'graduation_year' and data_type in ('integer', 'smallint', 'bigint')
    ) then
        alter table public.students
            add constraint students_graduation_year_check
            check (graduation_year is null or graduation_year between 1950 and 2100);
    end if;

    -- Alumni have no current year level.
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'students'
          and column_name = 'year_level' and is_nullable = 'NO'
    ) then
        alter table public.students alter column year_level drop not null;
    end if;
end;
$$;

alter table public.document_requests
    add column if not exists batch_id uuid;

create index if not exists document_requests_batch_idx
    on public.document_requests (batch_id)
    where batch_id is not null;

notify pgrst, 'reload schema';
