-- Fix: "Ask about a request" -> "All my requests" never got its automatic
-- reply. The once-a-minute check read v_req.request_number, and plpgsql
-- reads every field an expression mentions before running it -- even in a
-- CASE branch that isn't taken -- so asking about all requests (v_req never
-- filled) failed with 'record "v_req" is not assigned yet'. The check now
-- uses a plain text variable set beforehand.
--
-- Same function as 20260928030000 otherwise. Safe to re-run.

drop function if exists public.auto_reply_request_status(uuid);
drop function if exists public.auto_reply_request_status(uuid, uuid);
drop function if exists public.auto_reply_request_status(uuid, uuid, uuid);

-- p_request_id: the request asked about, or null for all of the student's
--   requests.
-- p_reply_as: the staff member whose conversation the question was asked
--   in, so the reply lands there. Must be an employee or the Registrar Head.
-- p_reply_to: the student's question; the reply quotes it ([[reply=<id>]]
--   tag, see src/lib/messageActions.js).
create or replace function public.auto_reply_request_status(
    p_request_id uuid default null,
    p_reply_as uuid default null,
    p_reply_to uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id uuid;
    v_req record;
    v_doc text;
    v_staff uuid;
    v_status record;
    v_next text;
    v_claim record;
    v_list text;
    v_text text;
    v_msg messages;
    v_key text := 'your requests';
begin
    select student_id into v_student_id from students where user_id = auth.uid();
    if v_student_id is null then
        raise exception 'Student record not found';
    end if;

    if p_request_id is not null then
        select dr.request_id, dr.request_number, dr.status::text as status, dr.assigned_employee_id, dr.document_type_id
          into v_req
          from document_requests dr
         where dr.request_id = p_request_id and dr.student_id = v_student_id;

        if not found then
            raise exception 'Request not found';
        end if;
        v_key := v_req.request_number;
    end if;

    -- One automatic reply per question per minute.
    if exists (
        select 1 from messages
         where receiver_user_id = auth.uid()
           and created_at > now() - interval '1 minute'
           and message like '%Automatic status update for ' || v_key || '%'
    ) then
        return null;
    end if;

    -- Who replies.
    if p_reply_as is not null and (
        exists (select 1 from employees where user_id = p_reply_as)
        or exists (select 1 from profiles where user_id = p_reply_as and role in ('registrar_head', 'admin'))
    ) then
        v_staff := p_reply_as;
    elsif p_request_id is not null then
        select e.user_id into v_staff from employees e where e.employee_id = v_req.assigned_employee_id;
    end if;
    if v_staff is null then
        select user_id into v_staff from profiles
         where role in ('registrar_head', 'admin')
         order by (role = 'registrar_head') desc, created_at
         limit 1;
    end if;
    if v_staff is null then
        raise exception 'No registrar staff available to reply';
    end if;

    if p_request_id is null then
        -- Every request, newest first: "- REQ-000123 (Transcript of Records): Processing"
        select string_agg(
                   format('- %s%s: %s',
                       dr.request_number,
                       coalesce(' (' || dt.document_name || ')', ''),
                       (public.request_status_text(dr.status::text)).label),
                   E'\n' order by dr.requested_at desc)
          into v_list
          from document_requests dr
          left join document_types dt on dt.document_type_id = dr.document_type_id
         where dr.student_id = v_student_id;

        v_text := 'Automatic status update for your requests:' || E'\n'
            || coalesce(v_list, 'You have no document requests yet.');
    else
        select document_name into v_doc from document_types where document_type_id = v_req.document_type_id;
        select * into v_status from public.request_status_text(v_req.status);
        v_next := v_status.next_step;

        select coalesce(cs.claim_date, cs.scheduled_date) as d, coalesce(cs.claim_time, cs.scheduled_time) as t
          into v_claim
          from claim_schedules cs
         where cs.request_id = v_req.request_id and cs.status = 'scheduled'
         order by cs.created_at desc
         limit 1;

        if v_claim.d is not null then
            v_next := format('Your claiming schedule is %s%s. Bring your official receipt and a valid ID.',
                to_char(v_claim.d, 'FMMonth FMDD, YYYY'),
                case when v_claim.t is not null then ' at ' || to_char(v_claim.t, 'FMHH12:MI AM') else '' end);
        end if;

        v_text := trim(format('Automatic status update for %s%s: %s. %s',
            v_req.request_number,
            coalesce(' (' || v_doc || ')', ''),
            v_status.label,
            v_next));
    end if;

    -- Quote the question, but only one the student themself sent.
    if p_reply_to is not null and exists (
        select 1 from messages where message_id = p_reply_to and sender_user_id = auth.uid()
    ) then
        v_text := '[[reply=' || p_reply_to || ']]' || v_text;
    end if;

    insert into messages (sender_user_id, receiver_user_id, message, is_read)
    values (v_staff, auth.uid(), v_text, false)
    returning * into v_msg;

    return to_jsonb(v_msg);
end;
$$;

revoke execute on function public.auto_reply_request_status(uuid, uuid, uuid) from public, anon;
grant execute on function public.auto_reply_request_status(uuid, uuid, uuid) to authenticated;
