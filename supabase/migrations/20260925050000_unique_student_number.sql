-- Stop two accounts registering with the same student ID.
--
-- Register used to create the auth account first and only then insert the
-- students row, so a taken ID left a half-made account (or, with no
-- uniqueness in the database, a duplicate student). Now:
--   1. is_student_number_taken() lets the sign-up forms check first. It only
--      returns true/false, so it's safe to expose to not-yet-signed-in users.
--   2. A unique index enforces it. Rejected registrations don't count, so a
--      student whose sign-up was rejected can register again.

create or replace function public.is_student_number_taken(p_student_number text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from students
        where student_number = btrim(p_student_number)
          and verification_status is distinct from 'rejected'
    );
$$;

revoke execute on function public.is_student_number_taken(text) from public;
grant execute on function public.is_student_number_taken(text) to anon, authenticated;

-- Only add the index if existing data allows it; otherwise report the
-- duplicates so they can be cleaned up first (the app check still works).
do $$
declare
    v_dupes text;
begin
    select string_agg(student_number || ' (x' || n || ')', ', ')
    into v_dupes
    from (
        select student_number, count(*) as n
        from students
        where verification_status is distinct from 'rejected'
        group by student_number
        having count(*) > 1
    ) d;

    if v_dupes is null then
        create unique index if not exists students_student_number_active_key
            on public.students (student_number)
            where verification_status is distinct from 'rejected';
    else
        raise notice 'Unique index NOT created; duplicate student numbers exist: %', v_dupes;
    end if;
end;
$$;

notify pgrst, 'reload schema';
