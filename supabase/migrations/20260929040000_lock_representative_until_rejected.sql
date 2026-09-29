-- Authorized representatives: once a student submits one, it is locked while
-- the Registrar reviews it and after it is approved. The student can change
-- the details, replace a file, or remove the representative only after it
-- was rejected (either file rejected, or the approval revoked).
--
-- Staff are not affected. A representative deleted together with its
-- request (cascade) is allowed.
--
-- Safe to re-run.

create or replace function public.lock_claim_representative()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_request_staff() then
        return case when tg_op = 'DELETE' then old else new end;
    end if;

    -- Cascade from the request being deleted: the request row is already gone.
    if tg_op = 'DELETE'
       and not exists (select 1 from public.document_requests where request_id = old.request_id) then
        return old;
    end if;

    if old.status is distinct from 'rejected' then
        raise exception using
            errcode = 'P0001',
            message = case when old.status = 'approved'
                then 'Your representative is already approved and can no longer be changed.'
                else 'Your representative is being reviewed by the Registrar. You can change it only if it is rejected.'
            end;
    end if;

    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_lock_claim_representative on public.claim_representatives;
create trigger trg_lock_claim_representative
before update or delete on public.claim_representatives
for each row execute function public.lock_claim_representative();

notify pgrst, 'reload schema';
