-- The standard-certificate process descriptions (20260916000000) listed a
-- paper "Claim Stub for due date (ORRM Counter 2)" step. CertiChain now
-- gives the student their claiming date and time in their account, so
-- there is no claim stub; remove that step from every document type.
--
-- Also align the claiming step with how claiming works in the system: the
-- processing employee sets the claiming time, rather than a fixed 3pm.
--
-- Pattern-based, so it works on descriptions the head may have edited, and
-- re-running it changes nothing.

update document_types
set description = regexp_replace(
        description,
        '\s*->\s*Claim Stub for due date\s*\([^)]*\)',
        '',
        'gi'
    )
where description ~* 'claim stub';

update document_types
set description = regexp_replace(
        description,
        'Claiming 3pm during due date',
        'Claiming during your due date, at the time set by the processing employee',
        'gi'
    )
where description ~* 'claiming 3pm during due date';
