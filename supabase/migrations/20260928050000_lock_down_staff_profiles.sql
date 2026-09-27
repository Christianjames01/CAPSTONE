-- Security: staff profiles were readable without logging in.
--
-- Found on the live project: anyone with the public (publishable) key --
-- which ships inside the website -- could read employee rows of
-- `profiles` (name, email, phone, status, failed login count, lock time,
-- session id) and `employees`, without signing in. The policy that allowed
-- it isn't in these migrations (it was likely added in the dashboard).
-- Nothing public needs this data: login lock checks go through the
-- login-guard edge function, and the Queue Display / credential
-- verification pages don't read either table.
--
-- 1. Every SELECT policy on profiles/employees that applies to anon (or to
--    everyone, "public") now applies to signed-in users only. What
--    signed-in users can see is unchanged by this step.
-- 2. directory_profiles(): names, role and photo only, for showing who a
--    message or request is from. Students use this instead of reading
--    staff profile rows (see 20260928060000 for the tighter step).
--
-- Safe to re-run.

do $$
declare
    p record;
begin
    for p in
        select policyname, tablename, cmd, roles
          from pg_policies
         where schemaname = 'public'
           and tablename in ('profiles', 'employees')
           and ('public' = any (roles) or 'anon' = any (roles))
    loop
        if p.cmd = 'SELECT' then
            execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
            raise notice 'Restricted to signed-in users: % on %', p.policyname, p.tablename;
        else
            -- ALL / INSERT / UPDATE / DELETE may be needed before sign-in
            -- (e.g. registration); left as is, but reported.
            raise notice 'Left unchanged (review): % on % (%)', p.policyname, p.tablename, p.cmd;
        end if;
    end loop;
end;
$$;

-- Registrar staff check that doesn't depend on profiles' own policies.
create or replace function public.is_registrar_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from profiles
         where user_id = auth.uid()
           and role in ('employee', 'registrar_head', 'admin')
    );
$$;

revoke execute on function public.is_registrar_staff() from public, anon;
grant execute on function public.is_registrar_staff() to authenticated;

-- Names, role and photo for a list of users -- what the Messages pages and
-- request pages need to show who someone is. Staff profiles are returned to
-- any signed-in user; other people's only to staff (and your own to you).
-- No email, phone or login details.
create or replace function public.directory_profiles(p_user_ids uuid[])
returns table (user_id uuid, first_name text, last_name text, role text, profile_photo_url text)
language sql
stable
security definer
set search_path = public
as $$
    select p.user_id, p.first_name::text, p.last_name::text, p.role::text, p.profile_photo_url::text
      from profiles p
     where p.user_id = any (p_user_ids)
       and auth.uid() is not null
       and (
            p.role::text in ('employee', 'registrar_head', 'admin')
            or p.user_id = auth.uid()
            or public.is_registrar_staff()
       );
$$;

revoke execute on function public.directory_profiles(uuid[]) from public, anon;
grant execute on function public.directory_profiles(uuid[]) to authenticated;
