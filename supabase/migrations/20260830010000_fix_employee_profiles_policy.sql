-- "Employees can view all profiles" checked auth.jwt() -> user_metadata ->
-- role, which isn't reliably kept in sync with profiles.role (the actual
-- source of truth used everywhere else via is_employee()). An employee
-- whose JWT didn't happen to carry that exact metadata claim couldn't see
-- any other user's profile -- surfacing as names showing "Unknown" in
-- employee-side student lists (existing search included, not just the new
-- pending-verification queue).
drop policy "Employees can view all profiles" on public.profiles;

create policy "Employees can view all profiles"
on public.profiles for select
to authenticated
using (is_employee());
