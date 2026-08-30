-- Public verification lookup for generated credentials, so anyone with a
-- credential number (or its QR code) can confirm a document is genuine
-- without needing an account. Deliberately exposes only what's needed to
-- verify authenticity -- not full student records.
create or replace view public_credential_verification as
select
    c.credential_number,
    c.status,
    c.generated_at,
    c.released_at,
    dt.document_name,
    dr.request_number,
    trim(concat(p.first_name, ' ', p.last_name)) as student_name,
    col.college_name,
    prog.program_name
from credentials c
join document_types dt on dt.document_type_id = c.document_type_id
join document_requests dr on dr.request_id = c.request_id
join students s on s.student_id = c.student_id
join profiles p on p.user_id = s.user_id
left join colleges col on col.college_id = s.college_id
left join programs prog on prog.program_id = s.program_id;

grant select on public_credential_verification to anon, authenticated;
