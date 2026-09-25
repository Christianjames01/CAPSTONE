-- Students can now submit a request even when no employee covers their
-- college/program; it's saved with assigned_employee_id = null and waits
-- on the admin Request Assignments page.
--
-- 1. When such a request is created, notify the registrar head(s) so it
--    doesn't sit unnoticed (students can't look up the head's account).
-- 2. When a request gets an employee (from null, or reassigned), notify
--    that employee, and tell the student when it was previously waiting.

create or replace function public.notify_heads_of_unassigned_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_program text;
begin
    if new.assigned_employee_id is null then
        select coalesce(pr.program_name, 'their program') || coalesce(' (' || c.college_name || ')', '')
        into v_program
        from students s
        left join programs pr on pr.program_id = s.program_id
        left join colleges c on c.college_id = s.college_id
        where s.student_id = new.student_id;

        insert into public.notifications (user_id, title, message, notification_type, related_request_id, is_read)
        select
            p.user_id,
            'Request needs an employee',
            'Request ' || coalesce(new.request_number, '') || ' from ' || coalesce(v_program, 'a student') ||
                ' has no assigned employee. Assign one on the Request Assignments page.',
            'request_update',
            new.request_id,
            false
        from public.profiles p
        where p.role in ('registrar_head', 'admin')
          and p.status = 'active';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_notify_heads_of_unassigned_request on public.document_requests;
create trigger trg_notify_heads_of_unassigned_request
after insert on public.document_requests
for each row
execute function public.notify_heads_of_unassigned_request();

create or replace function public.notify_on_request_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_employee_user uuid;
    v_employee_name text;
    v_student_user uuid;
begin
    if new.assigned_employee_id is null
        or new.assigned_employee_id is not distinct from old.assigned_employee_id then
        return new;
    end if;

    select e.user_id,
           coalesce(nullif(btrim(e.display_name), ''), nullif(btrim(p.first_name || ' ' || p.last_name), ''), 'a registrar employee')
    into v_employee_user, v_employee_name
    from employees e
    left join profiles p on p.user_id = e.user_id
    where e.employee_id = new.assigned_employee_id;

    if v_employee_user is not null then
        insert into public.notifications (user_id, title, message, notification_type, related_request_id, is_read)
        values (
            v_employee_user,
            'Request assigned to you',
            'Request ' || coalesce(new.request_number, '') || ' has been assigned to you.',
            'request_update',
            new.request_id,
            false
        );
    end if;

    -- The student was told they're waiting for staff; tell them who has it now.
    if old.assigned_employee_id is null then
        select s.user_id into v_student_user from students s where s.student_id = new.student_id;

        if v_student_user is not null then
            insert into public.notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                v_student_user,
                'Your request has been assigned',
                'Request ' || coalesce(new.request_number, '') || ' is now handled by ' || v_employee_name || '.',
                'request_update',
                new.request_id,
                false
            );
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_notify_on_request_assignment on public.document_requests;
create trigger trg_notify_on_request_assignment
after update of assigned_employee_id on public.document_requests
for each row
execute function public.notify_on_request_assignment();

revoke execute on function public.notify_heads_of_unassigned_request() from public, anon, authenticated;
revoke execute on function public.notify_on_request_assignment() from public, anon, authenticated;
