-- Updates fees, processing times, and process descriptions for the
-- "other certificates" (printouts, authentication, and the standard
-- certificate set) per the Registrar's current published rates.
--
-- fee = Amount + Documentary Stamp combined into a single charge (the
-- table has no separate doc-stamp column), broken out in the
-- description for transparency. Matched by document_code, so a code
-- that doesn't exist yet in this environment is a no-op rather than
-- an error.

-- Same-day printouts and authentication, no documentary stamp.
UPDATE document_types SET
    fee = 10.00,
    processing_days_min = 0,
    processing_days_max = 0,
    is_available = true,
    description = 'Amount: PHP 10.00. Claim: within the day.
Process: Request slip (ORRM Counter 2/ Course in charge) -> Signatory (Finance Account Section) -> Signatory and Charging (ORRM Course in charge) -> Payment (Finance Teller/Cashier) -> Releasing of requested docs. (ORRM Course in charge)'
WHERE document_code IN ('POE', 'POCS', 'POG');

UPDATE document_types SET
    fee = 12.00,
    processing_days_min = 0,
    processing_days_max = 0,
    is_available = true,
    description = 'Amount: PHP 12.00. Claim: within the day, if the Registrar is available.
Process: Request slip (ORRM Counter 2/ Course in charge) -> Signatory (Finance Account Section) -> Signatory and Charging (ORRM Course in charge) -> Payment (Finance Teller/Cashier) -> Releasing of requested docs. (ORRM Course in charge)'
WHERE document_code = 'CTC';

UPDATE document_types SET
    fee = 20.00,
    processing_days_min = NULL,
    processing_days_max = NULL,
    is_available = true,
    description = 'Amount: PHP 20.00.'
WHERE document_code = 'SCAN';

-- Standard certificates: PHP 20 amount + PHP 40 documentary stamp,
-- claimed after 7 working days via the counter claim-stub process.
UPDATE document_types SET
    fee = 60.00,
    processing_days_min = 7,
    processing_days_max = 7,
    is_available = true,
    description = 'Amount: PHP 20.00 + Doc Stamp: PHP 40.00 (Total PHP 60.00). Claim: 7 working days.
Process: Request slip (ORRM Counter 2/ Course in charge) -> Signatory (Finance Account Section) -> Signatory and Charging (ORRM Course in charge) -> Payment (Finance Teller/Cashier) -> Claim Stub for due date (ORRM Counter 2) -> Claiming 3pm during due date (ORRM Counter 3)'
WHERE document_code IN (
    'ADC', 'QAC', 'COE', 'COEUE', 'COESE', 'CUE', 'COG', 'CGCE',
    'CIRS', 'CRUS', 'CCAR', 'CCOM', 'LOC', 'CHON', 'CGWA', 'COGR', 'LNO'
);

-- Certificate of Cross-Enroll Permit has an extra priority-process note ahead
-- of the standard steps.
UPDATE document_types SET
    fee = 60.00,
    processing_days_min = 7,
    processing_days_max = 7,
    is_available = true,
    description = 'Amount: PHP 20.00 + Doc Stamp: PHP 40.00 (Total PHP 60.00). Claim: 7 working days.
Note: Priority Process (approved letter from the Program Chairperson and ORRM Course in charge). Regular Process: Request slip (ORRM Counter 2/ Course in charge) -> Signatory (Finance Account Section) -> Signatory and Charging (ORRM Course in charge) -> Payment (Finance Teller/Cashier) -> Claim Stub for due date (ORRM Counter 2) -> Claiming 3pm during due date (ORRM Counter 3)'
WHERE document_code = 'CCEP';

-- Propagate the new fees onto any not-yet-paid requests for these document
-- types, mirroring what the admin Documents page does on a manual fee edit
-- (see saveDocument() in src/pages/admin/Documents.jsx).
UPDATE document_requests dr
SET unit_fee = dt.fee
FROM document_types dt
WHERE dr.document_type_id = dt.document_type_id
    AND dt.document_code IN (
        'POE', 'POCS', 'POG', 'CTC', 'SCAN',
        'ADC', 'QAC', 'COE', 'COEUE', 'COESE', 'CUE', 'COG', 'CGCE',
        'CIRS', 'CRUS', 'CCAR', 'CCOM', 'LOC', 'CHON', 'CGWA', 'COGR', 'LNO', 'CCEP'
    )
    AND dr.status IN ('pending', 'payment_pending');
