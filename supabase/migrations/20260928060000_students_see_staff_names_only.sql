-- Security, step 2: signed-in students no longer read staff profile rows
-- (email, phone, failed login count, lock time, session id). They see
-- staff names and photos through directory_profiles() instead (added in
-- 20260928050000, which must be applied first).
--
-- profiles SELECT access becomes:
--   - your own profile;
--   - registrar staff (employee, head, admin): everyone's.
--
-- SAFETY CHECK: a policy on another table might look up someone else's
-- profile directly (e.g. "the receiver must be staff"). Under the new rules
-- a student couldn't see that row any more and the check would fail. So if
-- any policy outside `profiles` mentions profiles, this migration stops
-- without changing anything and lists them -- send the list to be adjusted.
-- Policies that only look up the caller's own row
-- (`profiles.user_id = auth.uid()`, e.g. "is the caller active staff?") are
-- fine: everyone can still read their own profile.
--
-- Safe to re-run.

do $$
declare
    p record;
    found_any boolean := false;
begin
    if to_regprocedure('public.directory_profiles(uuid[])') is null then
        raise exception 'Apply 20260928050000_lock_down_staff_profiles.sql first.';
    end if;

    for p in
        select tablename, policyname
          from pg_policies
         where schemaname = 'public'
           and tablename <> 'profiles'
           and (coalesce(qual, '') ~* '\mprofiles\M' or coalesce(with_check, '') ~* '\mprofiles\M')
           and not (coalesce(qual, '') || coalesce(with_check, '')) ~* 'profiles\.user_id\s*=\s*auth\.uid\(\)'
    loop
        found_any := true;
        raise warning 'Policy % on % reads profiles directly', p.policyname, p.tablename;
    end loop;

    if found_any then
        raise exception 'Stopped: policies above read profiles directly. Nothing was changed -- send this output so they can be adjusted first.';
    end if;
end;
$$;

-- Replace every SELECT policy on profiles with the two below. (ALL
-- policies, e.g. the head managing profiles, are left as they are.)
do $$
declare
    p record;
begin
    for p in
        select policyname from pg_policies
         where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
    loop
        execute format('drop policy %I on public.profiles', p.policyname);
        raise notice 'Dropped SELECT policy: %', p.policyname;
    end loop;
end;
$$;

create policy "Users can view their own profile"
    on public.profiles for select
    to authenticated
    using (user_id = auth.uid());

create policy "Registrar staff can view profiles"
    on public.profiles for select
    to authenticated
    using (public.is_registrar_staff());
