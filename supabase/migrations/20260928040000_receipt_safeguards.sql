-- Official receipt safeguards. One Finance Office receipt can pay for
-- several documents requested together, so a student may apply one receipt
-- to several requests -- but it has to be checked as one:
--
--   1. Receipt number required (UI) and never reused: a receipt number
--      already on another request is rejected, unless that other request
--      is in the same receipt group (the same upload) or its receipt was
--      rejected. Checked here because students can't see other students'
--      receipts.
--   2. One check for the whole group: receipt_group_id links the receipts
--      from one upload. When staff verify or reject any of them, the same
--      decision is applied to every request in the group (receipts,
--      request status, and a notification per request).
--   3. Same photo flagged: file_hash (SHA-256 of the uploaded file) lets
--      staff pages warn when an identical file was uploaded for another
--      request.
--
-- Safe to re-run.

alter table official_receipts add column if not exists file_hash text;
alter table official_receipts add column if not exists receipt_group_id uuid;

create index if not exists official_receipts_number_norm_idx
    on official_receipts (upper(regexp_replace(coalesce(receipt_number, ''), '\s', '', 'g')));
create index if not exists official_receipts_file_hash_idx on official_receipts (file_hash);
create index if not exists official_receipts_group_idx on official_receipts (receipt_group_id);

-- 1. A receipt number can only be used once --------------------------------
create or replace function public.check_receipt_number_unused()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_norm text;
begin
    if new.receipt_number is null or btrim(new.receipt_number) = '' then
        return new;
    end if;

    new.receipt_number := upper(btrim(new.receipt_number));
    v_norm := regexp_replace(new.receipt_number, '\s', '', 'g');

    if exists (
        select 1
          from official_receipts r
         where upper(regexp_replace(coalesce(r.receipt_number, ''), '\s', '', 'g')) = v_norm
           and r.receipt_id is distinct from new.receipt_id
           and r.request_id is distinct from new.request_id
           and r.status is distinct from 'rejected'
           and (new.receipt_group_id is null or r.receipt_group_id is distinct from new.receipt_group_id)
    ) then
        raise exception 'Receipt number % has already been used for another request. Each official receipt can only be used once -- if it paid for several documents, upload it once and tick all of them.', new.receipt_number
            using errcode = '23505';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_check_receipt_number_unused on public.official_receipts;
create trigger trg_check_receipt_number_unused
before insert or update of receipt_number, receipt_group_id on public.official_receipts
for each row
execute function public.check_receipt_number_unused();

-- 2. Verify / reject the whole group together ---------------------------------
create or replace function public.apply_receipt_decision_to_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.receipt_group_id is null
       or new.status is not distinct from old.status
       or new.status not in ('verified', 'rejected')
       or pg_trigger_depth() > 1 then
        return new;
    end if;

    -- The other requests in the group whose receipt is still unchecked.
    -- Requests and notifications first, then the receipts themselves (which
    -- is what marks them as no longer unchecked).
    if new.status = 'verified' then
        update document_requests dr
           set status = 'receipt_verified', rejection_reason = null, updated_at = now()
         where dr.request_id in (
                select r.request_id from official_receipts r
                 where r.receipt_group_id = new.receipt_group_id and r.receipt_id <> new.receipt_id and r.status = 'uploaded')
           and dr.status in ('pending', 'payment_pending', 'receipt_uploaded', 'rejected');

        insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
        select s.user_id, 'Payment verified',
               format('Your payment for request %s has been verified. Your document is now being processed.', dr.request_number),
               'request_update', dr.request_id, false
          from official_receipts r
          join document_requests dr on dr.request_id = r.request_id
          join students s on s.student_id = dr.student_id
         where r.receipt_group_id = new.receipt_group_id and r.receipt_id <> new.receipt_id and r.status = 'uploaded';
    else
        update document_requests dr
           set status = 'rejected', rejection_reason = new.rejection_reason, updated_at = now()
         where dr.request_id in (
                select r.request_id from official_receipts r
                 where r.receipt_group_id = new.receipt_group_id and r.receipt_id <> new.receipt_id and r.status = 'uploaded')
           and dr.status in ('pending', 'payment_pending', 'receipt_uploaded');

        insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
        select s.user_id, 'Payment rejected',
               format('Your payment for request %s was rejected: %s', dr.request_number, coalesce(new.rejection_reason, 'see your request for details')),
               'payment', dr.request_id, false
          from official_receipts r
          join document_requests dr on dr.request_id = r.request_id
          join students s on s.student_id = dr.student_id
         where r.receipt_group_id = new.receipt_group_id and r.receipt_id <> new.receipt_id and r.status = 'uploaded';
    end if;

    update official_receipts r
       set status = new.status,
           verified_by = new.verified_by,
           verified_at = coalesce(new.verified_at, now()),
           rejection_reason = new.rejection_reason
     where r.receipt_group_id = new.receipt_group_id
       and r.receipt_id <> new.receipt_id
       and r.status = 'uploaded';

    return new;
end;
$$;

drop trigger if exists trg_apply_receipt_decision_to_group on public.official_receipts;
create trigger trg_apply_receipt_decision_to_group
after update of status on public.official_receipts
for each row
execute function public.apply_receipt_decision_to_group();
