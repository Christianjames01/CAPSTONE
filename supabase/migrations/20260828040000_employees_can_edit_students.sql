-- The head already has UPDATE on students/profiles (from an earlier
-- migration). This extends that same ability to the "employee" role,
-- scoped narrowly: an employee may only update a profile that actually
-- belongs to a student, not arbitrary profiles (other employees, admins).

create policy "Employees can update student records"
on public.students
for update
to authenticated
using (is_employee())
with check (is_employee());

create policy "Employees can update student profiles"
on public.profiles
for update
to authenticated
using (
    is_employee()
    and exists (select 1 from students s where s.user_id = profiles.user_id)
)
with check (
    is_employee()
    and exists (select 1 from students s where s.user_id = profiles.user_id)
);
