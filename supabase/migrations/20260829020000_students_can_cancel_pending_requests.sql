-- Lets a student cancel their own request, but only while it's still
-- "pending" (before payment/processing has started), and only into the
-- "cancelled" status.
create policy "Students can cancel their own pending requests"
on public.document_requests
for update
to authenticated
using (
    status = 'pending'
    and student_id in (select students.student_id from students where students.user_id = auth.uid())
)
with check (
    status = 'cancelled'
    and student_id in (select students.student_id from students where students.user_id = auth.uid())
);
