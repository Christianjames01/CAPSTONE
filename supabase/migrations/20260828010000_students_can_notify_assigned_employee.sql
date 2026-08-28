-- When a student submits a new request, the app already auto-assigns it to
-- the least-loaded employee covering that college/program and calls
-- notify() to alert them (see findAssignedEmployee() + NewRequest.jsx).
-- But the only INSERT policy on `notifications` is "Registrar staff can
-- create notifications" (employee/registrar_head/admin roles only) -- a
-- student isn't covered, so that insert is silently dropped by RLS and the
-- employee never sees it.
--
-- This adds a narrowly-scoped INSERT policy: a student may only create a
-- notification tied to one of their OWN requests, addressed to the actual
-- employee assigned to that request. They can't notify arbitrary users or
-- attach a notification to a request that isn't theirs.

create policy "Students can notify their assigned employee"
on public.notifications
for insert
to authenticated
with check (
    notifications.notification_type = 'request_update'
    and notifications.related_request_id is not null
    and exists (
        select 1
        from document_requests dr
        join students s on s.student_id = dr.student_id
        join employees e on e.employee_id = dr.assigned_employee_id
        where dr.request_id = notifications.related_request_id
          and s.user_id = auth.uid()
          and e.user_id = notifications.user_id
    )
);
