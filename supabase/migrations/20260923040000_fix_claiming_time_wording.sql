-- "Claiming 3pm during due date" reads as a fixed universal time, but the
-- actual claim time is whatever the processing employee sets for that
-- request via the claim-schedule feature, not always 3pm. Corrects the
-- wording wherever it appears (the standard-certificate description set
-- from 20260916000000_update_other_certificates_pricing.sql) rather than
-- re-listing every affected document_code.
UPDATE document_types
SET description = replace(
    description,
    'Claiming 3pm during due date (ORRM Counter 3)',
    'Claiming during your due date, at the time set by the processing employee (ORRM Counter 3)'
)
WHERE description LIKE '%Claiming 3pm during due date%';
