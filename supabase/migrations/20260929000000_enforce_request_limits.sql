-- Enforce each document's request limits in the database, not only in the
-- browser, so they hold when many students submit at the same moment (or one
-- student submits from two tabs at once):
--   * max_active_requests: how many unfinished requests a student may have
--     for the same document at a time;
--   * max_quantity_per_request: how many copies one request may ask for.
--
-- A per-student-and-document lock makes simultaneous submissions wait for
-- each other, so the second one sees the first when it counts.
--
-- Only applies to students creating their own requests; staff inserting a
-- request on someone's behalf are not limited. Safe to re-run.

create or replace function public.enforce_request_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_doc record;
    v_active integer;
begin
    -- Staff (or the service role) creating a request: no limit.
    if not exists (
        select 1 from students s
         where s.student_id = new.student_id
           and s.user_id = auth.uid()
    ) then
        return new;
    end if;

    select document_name,
           coalesce(max_active_requests, 2) as max_active,
           coalesce(max_quantity_per_request, 2) as max_quantity
      into v_doc
      from document_types
     where document_type_id = new.document_type_id;

    if not found then
        return new;
    end if;

    if coalesce(new.quantity, 1) > v_doc.max_quantity then
        raise exception 'You can request up to % % of % per request.',
            v_doc.max_quantity,
            case when v_doc.max_quantity = 1 then 'copy' else 'copies' end,
            v_doc.document_name
            using errcode = 'P0001';
    end if;

    -- One submission at a time per student and document (released at the
    -- end of the transaction).
    perform pg_advisory_xact_lock(hashtext('request-limit:' || new.student_id::text || ':' || new.document_type_id::text));

    select count(*) into v_active
      from document_requests
     where student_id = new.student_id
       and document_type_id = new.document_type_id
       and status::text in (
           'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
           'processing', 'lacking_requirements', 'ready_for_claiming'
       );

    if v_active >= v_doc.max_active then
        raise exception 'You already have % active request% for %. Wait for one to finish before requesting it again.',
            v_active,
            case when v_active = 1 then '' else 's' end,
            v_doc.document_name
            using errcode = 'P0001';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_request_limits on public.document_requests;

create trigger trg_enforce_request_limits
before insert on public.document_requests
for each row
execute function public.enforce_request_limits();

revoke execute on function public.enforce_request_limits() from public, anon;
