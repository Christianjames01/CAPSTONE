-- Registrar heads had no way to learn about a newly self-registered
-- employee account waiting for activation short of manually checking the
-- Employees page. New employee rows are always created with status
-- 'inactive' (see EmployeeRegister.jsx / admin add-employee flow), so
-- fire a notification to every active head/admin whenever that happens.
--
-- SECURITY DEFINER is required here: the row is usually inserted either by
-- the brand-new employee themselves (whose own profile is still 'inactive',
-- so the general "Registrar staff can create notifications" RLS policy
-- would not let them insert on their own) or by an admin adding staff
-- directly. Running as the function owner bypasses RLS for this one
-- narrowly-scoped insert regardless of who triggered it.
create or replace function public.notify_heads_of_pending_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'inactive' then
        insert into public.notifications (user_id, title, message, notification_type)
        select
            p.user_id,
            'New employee awaiting activation',
            'A new registrar employee account (' || coalesce(new.employee_number, 'no employee number') ||
                ') has registered and needs to be activated before they can log in.',
            'system'
        from public.profiles p
        where p.role in ('registrar_head', 'admin')
          and p.status = 'active';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_notify_heads_of_pending_employee on public.employees;

create trigger trg_notify_heads_of_pending_employee
after insert on public.employees
for each row
execute function public.notify_heads_of_pending_employee();
