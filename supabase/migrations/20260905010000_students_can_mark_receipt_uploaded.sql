-- Uploading a receipt (UploadReceipt.jsx) tries to advance the request's
-- own status from pending/payment_pending/rejected to receipt_uploaded
-- right after saving the receipt row -- but no RLS policy ever let a
-- student update their own request's status at all (the only student
-- UPDATE policy is "can cancel their own pending requests", which only
-- permits the specific pending -> cancelled transition). The status
-- update was silently rejected by RLS every time, logged to the console
-- and never surfaced to the student, so a request could sit at "pending"
-- forever even after a real receipt was successfully uploaded.
create policy "Students can mark their own request as receipt uploaded"
on document_requests
for update
using (
    status = any (array['pending'::request_status, 'payment_pending'::request_status, 'rejected'::request_status])
    and student_id in (
        select students.student_id from students where students.user_id = auth.uid()
    )
)
with check (
    status = 'receipt_uploaded'::request_status
    and student_id in (
        select students.student_id from students where students.user_id = auth.uid()
    )
);
