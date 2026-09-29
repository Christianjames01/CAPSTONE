-- When staff flag a request as Lacking Requirements, tell the student right
-- away that it will be rejected and deleted if nothing is uploaded, with the
-- exact deadline (see 20260929070000_auto_reject_flagged_requests: rejected
-- 7 days after the flag, deleted 7 days after that).
--
-- Only when the auto-reject rule applies (no official receipt on file).
-- Safe to re-run.

create or replace function public.notify_flagged_request_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid;
    v_document text;
begin
    if new.status::text <> 'lacking_requirements'
       or old.status::text = 'lacking_requirements'
       or new.flagged_at is null then
        return new;
    end if;

    if exists (select 1 from official_receipts o where o.request_id = new.request_id) then
        return new;
    end if;

    select s.user_id into v_user from students s where s.student_id = new.student_id;
    if v_user is null then
        return new;
    end if;

    select coalesce(dt.document_name, 'your document') into v_document
      from document_types dt where dt.document_type_id = new.document_type_id;

    insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
    values (
        v_user,
        'Action needed: upload as soon as possible',
        format('Request %s (%s) was flagged for missing requirements. Please upload them as soon as possible. '
               || 'If nothing is uploaded by %s, the request will be rejected automatically and then deleted.',
               new.request_number, coalesce(v_document, 'your document'),
               to_char((new.flagged_at + interval '7 days') at time zone 'Asia/Manila', 'FMMonth FMDD, YYYY FMHH12:MI AM')),
        'request_update', new.request_id, false
    );

    return new;
exception when others then
    -- Never block the flag itself over the notice.
    raise warning 'flag deadline notice failed for %: %', new.request_id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_notify_flagged_request_deadline on public.document_requests;
create trigger trg_notify_flagged_request_deadline
after update of status on public.document_requests
for each row execute function public.notify_flagged_request_deadline();
