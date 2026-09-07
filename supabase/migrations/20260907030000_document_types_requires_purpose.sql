-- Lets specific document types require students to state a purpose before
-- submitting a request (e.g. a Reference letter or Letter of No Objection
-- makes little sense without one), instead of purpose being optional for
-- every document type. Defaults to false so no existing document type
-- changes behavior until a registrar explicitly turns it on.

ALTER TABLE document_types
    ADD COLUMN IF NOT EXISTS requires_purpose boolean NOT NULL DEFAULT false;

-- Enforce it server-side too, not just in the request form's UI validation,
-- so it can't be bypassed by calling the API directly.
DROP POLICY IF EXISTS "Students can create own requests" ON document_requests;
CREATE POLICY "Students can create own requests"
    ON document_requests FOR INSERT
    WITH CHECK (
        student_id IN (SELECT students.student_id FROM students WHERE students.user_id = auth.uid())
        AND NOT EXISTS (
            SELECT 1 FROM document_types dt
            WHERE dt.document_type_id = document_requests.document_type_id
            AND dt.requires_purpose = true
            AND (document_requests.purpose IS NULL OR btrim(document_requests.purpose) = '')
        )
    );
