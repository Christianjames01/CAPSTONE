-- Lets specific document types require students to state a purpose before
-- submitting a request (e.g. a Reference letter or Letter of No Objection
-- makes little sense without one), instead of purpose being optional for
-- every document type. Defaults to false so no existing document type
-- changes behavior until a registrar explicitly turns it on.

ALTER TABLE document_types
    ADD COLUMN IF NOT EXISTS requires_purpose boolean NOT NULL DEFAULT false;

-- Enforce it server-side too, not just in the request form's UI validation,
-- so it can't be bypassed by calling the API directly.
--
-- This has to go through a SECURITY DEFINER function rather than a plain
-- subquery on document_types: document_types has its own SELECT policy
-- ("Students can view document types for their own requests") that
-- subqueries document_requests, so a plain subquery here would create an
-- RLS cycle (document_requests INSERT check -> document_types SELECT
-- policy -> document_requests SELECT policy -> ...), which Postgres
-- rejects with "infinite recursion detected in policy for relation
-- document_requests". A SECURITY DEFINER function reads document_types
-- without going through its RLS policies, breaking the cycle.
CREATE OR REPLACE FUNCTION document_type_requires_purpose(doc_type_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE((SELECT requires_purpose FROM document_types WHERE document_type_id = doc_type_id), false);
$$;

DROP POLICY IF EXISTS "Students can create own requests" ON document_requests;
CREATE POLICY "Students can create own requests"
    ON document_requests FOR INSERT
    WITH CHECK (
        student_id IN (SELECT students.student_id FROM students WHERE students.user_id = auth.uid())
        AND (
            NOT document_type_requires_purpose(document_type_id)
            OR (purpose IS NOT NULL AND btrim(purpose) <> '')
        )
    );
