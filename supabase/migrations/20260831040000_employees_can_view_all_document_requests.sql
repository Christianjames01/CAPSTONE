-- The student profile/history page (employee & admin) needs to show a
-- student's full request history regardless of who it's assigned to --
-- registrar staff look up students, not just their own queue. The existing
-- "assigned requests only" policy stays (AssignedRequests still filters by
-- assigned_employee_id in its own query), this just removes the RLS ceiling
-- that made every OTHER employee's view of a student's history come back
-- empty.
create policy "Employees can view all document requests"
on public.document_requests for select
to authenticated
using (is_employee());
