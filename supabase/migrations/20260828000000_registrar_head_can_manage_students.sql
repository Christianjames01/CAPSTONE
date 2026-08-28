-- The `employees` table already lets a registrar head (or admin) UPDATE/DELETE
-- any row via is_registrar_head(). `profiles` and `students` were never given
-- the same policies -- only "update your own row" policies exist for them.
-- That's why deactivating/deleting a student from the admin Students page
-- silently affected 0 rows: the client-side update ran, RLS filtered it out,
-- and no error was returned.
--
-- This adds the missing policies, mirroring the existing employees ones.

create policy "Registrar head and admin can update profiles"
on public.profiles
for update
to authenticated
using (is_registrar_head())
with check (is_registrar_head());

create policy "Registrar head and admin can update students"
on public.students
for update
to authenticated
using (is_registrar_head())
with check (is_registrar_head());

create policy "Registrar head and admin can delete students"
on public.students
for delete
to authenticated
using (is_registrar_head());
