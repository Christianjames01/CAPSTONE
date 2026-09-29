-- Unpaid requests left hanging: Pending / Payment Pending with no official
-- receipt and nothing uploaded by the student since it started waiting.
-- Same schedule as flagged requests (20260929070000):
--   day 3: final warning to the student;
--   day 7: rejected automatically (the student is told why);
--   7 days after that: deleted (by auto_reject_flagged_requests, which
--   removes every automatically rejected request).
-- Paying (uploading a receipt), uploading a requirement, or staff moving the
-- request on stops it.
--
-- Needs 20260929070000_auto_reject_flagged_requests. Safe to re-run.

alter table public.document_requests
    add column if not exists unpaid_since timestamptz,
    add column if not exists unpaid_warned_at timestamptz;

-- Start the clock when a request is (again) waiting for payment.
create or replace function public.stamp_request_unpaid_since()
returns trigger
language plpgsql
as $$
begin
    if new.status::text in ('pending', 'payment_pending') then
        if tg_op = 'INSERT' then
            new.unpaid_since := coalesce(new.requested_at, now());
            new.unpaid_warned_at := null;
        elsif old.status::text not in ('pending', 'payment_pending') then
            new.unpaid_since := now();
            new.unpaid_warned_at := null;
        end if;
    else
        new.unpaid_since := null;
        new.unpaid_warned_at := null;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_stamp_request_unpaid_since on public.document_requests;
create trigger trg_stamp_request_unpaid_since
before insert or update of status on public.document_requests
for each row execute function public.stamp_request_unpaid_since();

-- Requests already waiting: the clock starts at their last change, but never
-- less than a fresh 3-day warning + 4 days to act.
update public.document_requests
   set unpaid_since = greatest(coalesce(updated_at, requested_at, now()), now() - interval '3 days')
 where status::text in ('pending', 'payment_pending')
   and unpaid_since is null;

create or replace function public.auto_reject_unpaid_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;
    v_warned integer := 0;
    v_rejected integer := 0;
    v_reason constant text :=
        'Automatically rejected: the fee was not paid (no official receipt uploaded) within 7 days.';
begin
    -- Day 3: final warning (once).
    for r in
        select dr.request_id, dr.request_number, dr.unpaid_since, s.user_id,
               coalesce(dt.document_name, 'your document') as document_name
          from document_requests dr
          join students s on s.student_id = dr.student_id
          left join document_types dt on dt.document_type_id = dr.document_type_id
         where dr.status::text in ('pending', 'payment_pending')
           and dr.unpaid_since <= now() - interval '3 days'
           and dr.unpaid_since > now() - interval '7 days'
           and dr.unpaid_warned_at is null
    loop
        continue when not request_untouched_since_flag(r.request_id, r.unpaid_since);
        begin
            insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                r.user_id,
                'Pay as soon as possible: your request will be rejected',
                format('Request %s (%s) is still waiting for payment. Pay at the HCDC Finance Office and upload your official receipt by %s, or the request will be rejected automatically and then deleted.',
                       r.request_number, r.document_name,
                       to_char((r.unpaid_since + interval '7 days') at time zone 'Asia/Manila', 'FMMonth FMDD, YYYY FMHH12:MI AM')),
                'request_update', r.request_id, false
            );
            update document_requests set unpaid_warned_at = now() where request_id = r.request_id;
            v_warned := v_warned + 1;
        exception when others then
            raise warning 'unpaid warning failed for %: %', r.request_id, sqlerrm;
        end;
    end loop;

    -- Day 7: reject (deleted 7 days later by auto_reject_flagged_requests).
    for r in
        select dr.request_id, dr.request_number, dr.unpaid_since, s.user_id,
               coalesce(dt.document_name, 'your document') as document_name
          from document_requests dr
          join students s on s.student_id = dr.student_id
          left join document_types dt on dt.document_type_id = dr.document_type_id
         where dr.status::text in ('pending', 'payment_pending')
           and dr.unpaid_since <= now() - interval '7 days'
    loop
        continue when not request_untouched_since_flag(r.request_id, r.unpaid_since);
        begin
            update document_requests
               set status = 'rejected',
                   rejection_reason = v_reason,
                   auto_rejected_at = now()
             where request_id = r.request_id
               and status::text in ('pending', 'payment_pending');

            insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                r.user_id,
                'Request rejected',
                format('Request %s (%s) was rejected because it was not paid within 7 days. It will be removed in 7 days. You can submit a new request anytime.',
                       r.request_number, r.document_name),
                'request_update', r.request_id, false
            );

            begin
                insert into activity_logs (user_id, action, table_name, record_id, description)
                values (null, 'auto_reject_request', 'document_requests', r.request_id,
                        format('Request %s was rejected automatically: not paid within 7 days.', r.request_number));
            exception when others then
                null;
            end;

            v_rejected := v_rejected + 1;
        exception when others then
            raise warning 'unpaid auto-reject failed for %: %', r.request_id, sqlerrm;
        end;
    end loop;

    return jsonb_build_object('warned', v_warned, 'rejected', v_rejected);
end;
$$;

revoke execute on function public.auto_reject_unpaid_requests() from public, anon, authenticated;

-- Every hour, at minute 20.
do $$
begin
    if exists (select 1 from cron.job where jobname = 'auto-reject-unpaid-requests') then
        perform cron.unschedule('auto-reject-unpaid-requests');
    end if;
end;
$$;

select cron.schedule(
    'auto-reject-unpaid-requests',
    '20 * * * *',
    $$ select public.auto_reject_unpaid_requests(); $$
);

notify pgrst, 'reload schema';
