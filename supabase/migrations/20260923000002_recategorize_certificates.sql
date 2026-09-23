-- Documents named "Certificate ..." / "... Certificate ..." had been filed
-- under topical categories (Enrollment, Graduation, Academic Records, etc.)
-- instead of the "Certificate" category, leaving that filter empty on the
-- admin Documents page. Recategorizes any document whose name mentions
-- "certificate" so they all live under the Certificate category, matching
-- what the name already tells the admin it is.
UPDATE document_types
SET category = 'certificate'
WHERE document_name ILIKE '%certificate%'
    AND category IS DISTINCT FROM 'certificate';
