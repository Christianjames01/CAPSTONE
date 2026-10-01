-- Students can only change what the app lets them change on their requests.
--
-- Row Level Security decides WHICH rows a student may write, not which
-- columns. The "create own requests" and "mark as receipt uploaded" policies
-- let a student send any column -- e.g. a ₱0.01 unit_fee, a request created
-- already "ready_for_claiming", or a changed document type -- or bring back
-- a request that was rejected automatically.
--
-- For students (signed in, not registrar staff):
--   INSERT: status 'pending', the fee from document_types, staff-only fields
--           cleared;
--   UPDATE: only status, cancellation_reason, cancelled_at and updated_at
--           may change (the policies still decide which statuses), and an
--           automatically rejected request can't be revived.
-- Staff, the database itself and scheduled jobs are not affected.
--
-- The trigger name starts with "a00" so it runs before any other BEFORE
-- trigger (e.g. one that works out total_amount from unit_fee).
--
-- Safe to re-run.

create or replace function public.guard_student_request_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_reason text;
    v_cancelled_at timestamptz;
    v_updated_at timestamptz;
begin
    -- Not a signed-in user (scheduled jobs, SQL editor) or staff: leave it.
    if auth.uid() is null or public.is_request_staff() then
        return new;
    end if;

    if tg_op = 'INSERT' then
        new.status := 'pending';
        new.unit_fee := coalesce((select dt.fee from document_types dt where dt.document_type_id = new.document_type_id), 0);
        new.priority := 'normal';
        new.rejection_reason := null;
        new.employee_remarks := null;
        new.processed_at := null;
        new.completed_at := null;
        return new;
    end if;

    -- UPDATE
    if old.auto_rejected_at is not null then
        raise exception 'This request was rejected automatically. Please submit a new request.' using errcode = '42501';
    end if;

    v_status := new.status::text;
    v_reason := new.cancellation_reason;
    v_cancelled_at := new.cancelled_at;
    v_updated_at := new.updated_at;

    new := old;
    new.status := v_status;
    new.cancellation_reason := v_reason;
    new.cancelled_at := v_cancelled_at;
    new.updated_at := v_updated_at;
    return new;
end;
$$;

revoke execute on function public.guard_student_request_write() from public, anon, authenticated;

drop trigger if exists a00_guard_student_request_write on public.document_requests;
create trigger a00_guard_student_request_write
before insert or update on public.document_requests
for each row execute function public.guard_student_request_write();
