-- Lets the registrar head / admin set a temporary password for an employee
-- from the admin Employee page. The employee is signed out everywhere and,
-- via profiles.must_change_password (20260907020000), must create a new
-- password on their next login before using the portal (ProtectedRoute ->
-- /force-change-password).
--
-- Done as a security-definer function (rather than an edge function) so it
-- enforces the caller/target checks in the database itself.

create or replace function public.reset_employee_password(p_employee_user_id uuid, p_temp_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_caller uuid := auth.uid();
    v_target_role text;
begin
    if v_caller is null then
        raise exception 'Not signed in.';
    end if;

    if not is_registrar_head() then
        raise exception 'Only the registrar head or an admin can reset employee passwords.';
    end if;

    if p_employee_user_id = v_caller then
        raise exception 'Use your Profile page to change your own password.';
    end if;

    if length(coalesce(p_temp_password, '')) < 8 then
        raise exception 'The temporary password must be at least 8 characters.';
    end if;

    select role into v_target_role from public.profiles where user_id = p_employee_user_id;

    if v_target_role is distinct from 'employee' then
        raise exception 'That account is not an employee.';
    end if;

    update auth.users
    set encrypted_password = extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = p_employee_user_id;

    update public.profiles
    set must_change_password = true
    where user_id = p_employee_user_id;

    -- Sign them out everywhere so the old password's sessions can't linger
    -- (refresh tokens cascade with their session).
    delete from auth.sessions where user_id = p_employee_user_id;
end;
$$;

revoke execute on function public.reset_employee_password(uuid, text) from public, anon;
grant execute on function public.reset_employee_password(uuid, text) to authenticated;

notify pgrst, 'reload schema';
