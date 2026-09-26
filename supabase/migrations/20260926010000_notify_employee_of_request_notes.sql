-- When someone adds a staff note to a request (20260926000000_request_notes),
-- notify the request's assigned employee -- unless they wrote it themselves.
-- The notification links to the request, so clicking it opens the page with
-- the note. SECURITY DEFINER so the insert works whoever adds the note.

create or replace function public.notify_assigned_employee_of_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_request_number text;
    v_label text;
begin
    select e.user_id, r.request_number
    into v_user_id, v_request_number
    from document_requests r
    join employees e on e.employee_id = r.assigned_employee_id
    where r.request_id = new.request_id
      and e.status = 'active';

    if v_user_id is null or v_user_id is not distinct from new.author_user_id then
        return new;
    end if;

    v_label := case new.category
        when 'absence' then 'an absence/coverage note'
        when 'follow_up' then 'a follow-up note'
        when 'issue' then 'an issue note'
        else 'a note'
    end;

    insert into public.notifications (user_id, title, message, notification_type, related_request_id, is_read)
    values (
        v_user_id,
        'New note on ' || coalesce(v_request_number, 'your request'),
        coalesce(new.author_name, 'A staff member') || ' added ' || v_label || ': "' ||
            case when length(new.body) > 140 then left(new.body, 137) || '...' else new.body end || '"',
        'request_update',
        new.request_id,
        false
    );

    return new;
end;
$$;

drop trigger if exists trg_notify_assigned_employee_of_note on public.request_notes;

-- AFTER insert, so the author details stamped by trg_stamp_request_note
-- (a BEFORE trigger) are already on the row.
create trigger trg_notify_assigned_employee_of_note
after insert on public.request_notes
for each row
execute function public.notify_assigned_employee_of_note();
