-- Same class of bug as the profiles fix: "Students can update own student
-- record" restricts which ROW can be touched but not which COLUMNS, so a
-- student could PATCH their own verification_status to 'approved' and
-- bypass the registrar's manual enrollment verification entirely (also
-- status, enrollment_status, college_id, program_id -- all meant to be
-- set only by staff). Verified exploitable before this fix.
create or replace function public.prevent_student_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_staff boolean;
begin
    select exists (
        select 1 from profiles p
        where p.user_id = auth.uid()
          and p.role in ('employee', 'registrar_head', 'admin')
          and p.status = 'active'
    ) into v_is_staff;

    if v_is_staff then
        return new;
    end if;

    if new.verification_status is distinct from old.verification_status
        or new.verification_note is distinct from old.verification_note
        or new.verified_by is distinct from old.verified_by
        or new.verified_at is distinct from old.verified_at
        or new.status is distinct from old.status
        or new.enrollment_status is distinct from old.enrollment_status
        or new.college_id is distinct from old.college_id
        or new.program_id is distinct from old.program_id
    then
        raise exception 'You are not allowed to change your own enrollment/verification status.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_prevent_student_self_approval on public.students;

create trigger trg_prevent_student_self_approval
before update on public.students
for each row
execute function public.prevent_student_self_approval();
