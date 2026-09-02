-- CRITICAL: "Students can update own profile" (and the employee/staff
-- update policies) restrict which ROW can be updated, but RLS is row-level,
-- not column-level -- nothing stopped a student from PATCHing their own
-- profiles row with role: 'admin' and instantly gaining full admin access
-- everywhere role is checked (route guards, and every RLS policy that
-- trusts profiles.role). Verified exploitable via RLS impersonation before
-- this fix; verified blocked, and staff account-status changes still work,
-- after it.
create or replace function public.prevent_profile_self_escalation()
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
          and p.role in ('registrar_head', 'admin')
          and p.status = 'active'
    ) into v_is_staff;

    if v_is_staff then
        return new;
    end if;

    if new.role is distinct from old.role then
        raise exception 'You are not allowed to change your account role.';
    end if;

    if new.status is distinct from old.status then
        raise exception 'You are not allowed to change your account status.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_prevent_profile_self_escalation on public.profiles;

create trigger trg_prevent_profile_self_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_self_escalation();
