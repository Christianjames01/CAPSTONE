-- Remind students about requests that have been waiting on them for 2 days.
--
-- A request that is still Pending / Payment Pending (not paid or no receipt
-- uploaded yet) or Requirements Needed 2 days after it last changed gets a
-- notification (which also triggers the existing email alert). If it still
-- hasn't moved, the student is reminded again every 2 days, at most 3 times
-- per status; the count resets when the status changes.
--
-- Runs every hour inside the database (pg_cron), no edge function or
-- secret needed. Safe to re-run.

alter table public.document_requests
    add column if not exists pending_reminder_count integer not null default 0,
    add column if not exists pending_reminder_sent_at timestamptz,
    add column if not exists pending_reminder_status text;

create or replace function public.send_pending_request_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer := 0;
    r record;
begin
    for r in
        select dr.request_id, dr.request_number, dr.status::text as status, s.user_id,
               coalesce(dt.document_name, 'your document') as document_name,
               case when dr.pending_reminder_status is distinct from dr.status::text then 0
                    else dr.pending_reminder_count end as sent_so_far
          from document_requests dr
          join students s on s.student_id = dr.student_id
          left join document_types dt on dt.document_type_id = dr.document_type_id
         where dr.status::text in ('pending', 'payment_pending', 'lacking_requirements')
           -- waiting 2 days since it last changed
           and coalesce(dr.updated_at, dr.requested_at) <= now() - interval '2 days'
           -- and 2 days since the last reminder about this same status
           and (dr.pending_reminder_status is distinct from dr.status::text
                or dr.pending_reminder_sent_at is null
                or dr.pending_reminder_sent_at <= now() - interval '2 days')
           and (dr.pending_reminder_status is distinct from dr.status::text
                or dr.pending_reminder_count < 3)
    loop
        insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
        values (
            r.user_id,
            case when r.status = 'lacking_requirements' then 'Your request still needs requirements'
                 else 'Your request is still waiting for payment' end,
            case when r.status = 'lacking_requirements' then
                format('Request %s (%s) is on hold until the missing requirements are uploaded. Open the request to see what''s needed and upload them so the Registrar can continue.', r.request_number, r.document_name)
            else
                format('Request %s (%s) has been pending for more than 2 days. Pay the fee at the HCDC Finance Office, then upload your official receipt so the Registrar can start processing it.', r.request_number, r.document_name)
            end,
            'request_update',
            r.request_id,
            false
        );

        -- Set the reminder fields without touching updated_at's meaning
        -- (the "2 days since it last changed" clock).
        update document_requests
           set pending_reminder_count = r.sent_so_far + 1,
               pending_reminder_sent_at = now(),
               pending_reminder_status = r.status
         where request_id = r.request_id;

        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

revoke execute on function public.send_pending_request_reminders() from public, anon, authenticated;

-- Every hour, on the hour.
do $$
begin
    if exists (select 1 from cron.job where jobname = 'pending-request-reminders') then
        perform cron.unschedule('pending-request-reminders');
    end if;
end;
$$;

select cron.schedule(
    'pending-request-reminders',
    '0 * * * *',
    $$ select public.send_pending_request_reminders(); $$
);
