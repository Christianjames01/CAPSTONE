-- Messages: a student asks "what's the status of REQ-000123?" -- or of all
-- their requests -- from the Messages page, and gets an automatic reply
-- right away with the current status and next step. The reply is a normal
-- message from the staff member in that conversation (else the employee
-- handling the request, else the Registrar Head), so staff see it too, and
-- it quotes the student's question like a Messenger reply.
--
-- Students can only send messages as themselves, so this is a security
-- definer function: it only answers about the caller's own requests and
-- sends at most one automatic reply per question per minute.
--
-- Safe to re-run.

-- Same wording students see on their request page.
create or replace function public.request_status_text(p_status text, out label text, out next_step text)
language sql
immutable
as $$
    select coalesce(t.status_label, initcap(replace(p_status, '_', ' '))), coalesce(t.next_step, '')
    from (select 1) as one
    left join (values
        ('pending',              'Pending',            'Your request is waiting for Registrar processing. Pay at the Finance Office and upload your official receipt.'),
        ('payment_pending',      'Payment Pending',    'Pay at the Finance Office, then upload your official receipt so the Registrar can verify it.'),
        ('receipt_uploaded',     'Receipt Uploaded',   'Your official receipt has been uploaded and is waiting for the Registrar to verify your payment.'),
        ('receipt_verified',     'Payment Verified',   'Your payment has been verified. Your request will begin processing soon.'),
        ('processing',           'Processing',         'Your request is currently being processed by the Registrar.'),
        ('lacking_requirements', 'Requirements Needed','Some required documents are still missing or need to be re-submitted. Please check the Requirements on your request.'),
        ('ready_for_claiming',   'Ready for Claiming', 'Your document has been prepared. You will be notified once a claiming schedule is set.'),
        ('completed',            'Completed',          'Your document request has been completed and claimed.'),
        ('rejected',             'Rejected',           'Your official receipt could not be verified. Please upload a new receipt to continue your request.'),
        ('cancelled',            'Cancelled',          'This request has been cancelled.')
    ) as t(status, status_label, next_step) on t.status = p_status;
$$;

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
    end if;

    -- One automatic reply per question per minute.
    if exists (
        select 1 from messages
         where receiver_user_id = auth.uid()
           and created_at > now() - interval '1 minute'
           and message like '%Automatic status update for '
               || case when p_request_id is null then 'your requests' else v_req.request_number end || '%'
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
