-- Messages: a student asks "what's the status of REQ-000123?" from the
-- Messages page, and gets an automatic reply right away with the request's
-- current status and next step. The reply is a normal message from the
-- employee handling the request (or the Registrar Head when none is
-- assigned), so it sits in that conversation and staff see it too.
--
-- Students can only send messages as themselves, so this is a security
-- definer function: it checks the request belongs to the caller, writes the
-- reply, and allows at most one automatic reply per request per minute.
--
-- Safe to re-run.

drop function if exists public.auto_reply_request_status(uuid);

-- p_reply_as: the staff member whose conversation the question was asked
-- in, so the reply lands there. Must be an employee or the Registrar Head;
-- otherwise the employee handling the request (or the head) replies.
create or replace function public.auto_reply_request_status(p_request_id uuid, p_reply_as uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_req record;
    v_doc text;
    v_staff uuid;
    v_label text;
    v_next text;
    v_claim record;
    v_text text;
    v_msg messages;
begin
    select dr.request_id, dr.request_number, dr.status, dr.assigned_employee_id, dr.document_type_id,
           s.user_id as student_user_id, s.student_id
      into v_req
      from document_requests dr
      join students s on s.student_id = dr.student_id
     where dr.request_id = p_request_id;

    if not found or v_req.student_user_id is distinct from auth.uid() then
        raise exception 'Request not found';
    end if;

    if exists (
        select 1 from messages
         where receiver_user_id = auth.uid()
           and message like 'Automatic status update for ' || v_req.request_number || '%'
           and created_at > now() - interval '1 minute'
    ) then
        return null;
    end if;

    select document_name into v_doc from document_types where document_type_id = v_req.document_type_id;

    if p_reply_as is not null and (
        exists (select 1 from employees where user_id = p_reply_as)
        or exists (select 1 from profiles where user_id = p_reply_as and role in ('registrar_head', 'admin'))
    ) then
        v_staff := p_reply_as;
    else
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

    -- Same wording students see on their request page.
    select status_label, next_step into v_label, v_next from (values
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
    ) as t(status, status_label, next_step)
    where t.status = v_req.status::text;

    v_label := coalesce(v_label, initcap(replace(v_req.status::text, '_', ' ')));
    v_next := coalesce(v_next, '');

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

    v_text := format('Automatic status update for %s%s: %s. %s',
        v_req.request_number,
        case when v_doc is not null then ' (' || v_doc || ')' else '' end,
        v_label,
        v_next);

    insert into messages (sender_user_id, receiver_user_id, message, is_read)
    values (v_staff, auth.uid(), trim(v_text), false)
    returning * into v_msg;

    return to_jsonb(v_msg);
end;
$$;

revoke execute on function public.auto_reply_request_status(uuid, uuid) from public, anon;
grant execute on function public.auto_reply_request_status(uuid, uuid) to authenticated;
