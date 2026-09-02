-- Same bug class as the profiles/students self-escalation fixes: the
-- student-facing UPDATE policies on official_receipts and
-- request_requirements only check row ownership, not which columns
-- change. Verified exploitable: a student could directly set their own
-- receipt to status='verified' (bypassing Finance/Registrar payment
-- verification) or their own uploaded requirement to status='approved'
-- (bypassing staff document review).
--
-- The student's legitimate resubmit flow (UploadReceipt.jsx /
-- UploadRequirements.jsx) always sets status to exactly 'uploaded' and
-- clears verified_by/verified_at/reviewed_by/reviewed_at/rejection_reason
-- to null -- that specific transition stays allowed; anything else
-- (setting status to 'verified'/'approved'/'rejected', or setting the
-- reviewer fields to a non-null value) is blocked unless the actor is
-- active staff.

create or replace function public.prevent_receipt_self_verification()
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

    if new.status is distinct from old.status and new.status is distinct from 'uploaded' then
        raise exception 'You are not allowed to change this receipt''s verification status.';
    end if;

    if new.verified_by is not null or new.verified_at is not null then
        raise exception 'You are not allowed to verify your own receipt.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_prevent_receipt_self_verification on public.official_receipts;

create trigger trg_prevent_receipt_self_verification
before update on public.official_receipts
for each row
execute function public.prevent_receipt_self_verification();

create or replace function public.prevent_requirement_self_approval()
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

    if new.status is distinct from old.status and new.status is distinct from 'uploaded' then
        raise exception 'You are not allowed to change this requirement''s review status.';
    end if;

    if new.reviewed_by is not null or new.reviewed_at is not null then
        raise exception 'You are not allowed to review your own requirement.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_prevent_requirement_self_approval on public.request_requirements;

create trigger trg_prevent_requirement_self_approval
before update on public.request_requirements
for each row
execute function public.prevent_requirement_self_approval();
