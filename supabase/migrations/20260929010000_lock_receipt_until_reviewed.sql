-- One receipt at a time: once a student uploads an official receipt it waits
-- for the Registrar. The student may upload a new one only after that one is
-- REJECTED -- not while it's still being checked, and never after it's
-- verified. The Upload Receipt page already hides the form; this makes the
-- database refuse it too (another tab, an old page, a direct API call).
--
-- Staff (employee / registrar head / admin) are not affected -- same staff
-- check as prevent_receipt_self_verification. Safe to re-run.

create or replace function public.lock_receipt_until_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_staff boolean;
begin
    select exists (
        select 1 from profiles p
        where p.user_id = auth.uid()
          and p.role in ('employee', 'registrar_head', 'admin')
          and p.status = 'active'
    ) into v_is_staff;

    if v_is_staff then
        return new;
    end if;

    if tg_op = 'UPDATE' then
        if old.status is distinct from 'rejected' then
            raise exception '%', case
                when old.status = 'verified' then 'Your payment is already verified. A new receipt can''t be uploaded.'
                else 'Your receipt is still waiting for the Registrar. You can upload a new one only if it is rejected.'
            end
            using errcode = 'P0001';
        end if;
        return new;
    end if;

    -- INSERT: no second receipt while one is pending or verified.
    if exists (
        select 1 from official_receipts r
         where r.request_id = new.request_id
           and r.status is distinct from 'rejected'
    ) then
        raise exception 'A receipt was already uploaded for this request and is waiting for the Registrar. You can upload a new one only if it is rejected.'
            using errcode = 'P0001';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_lock_receipt_until_reviewed on public.official_receipts;

create trigger trg_lock_receipt_until_reviewed
before insert or update on public.official_receipts
for each row
execute function public.lock_receipt_until_reviewed();

revoke execute on function public.lock_receipt_until_reviewed() from public, anon;
