-- Same gap as the earlier document_types fix for employees: students
-- could only see document_types where is_available = true, so a
-- student viewing their own past request for a document type that's
-- since been disabled would lose the document name (falls back to
-- "Document"). Scoped to document types tied to one of the student's
-- own requests, not all document types regardless of availability.
create policy "Students can view document types for their own requests"
on document_types
for select
using (
    exists (
        select 1
        from document_requests dr
        join students s on s.student_id = dr.student_id
        where dr.document_type_id = document_types.document_type_id
          and s.user_id = auth.uid()
    )
);
