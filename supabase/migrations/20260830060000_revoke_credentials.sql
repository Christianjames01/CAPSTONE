-- Lets registrar staff revoke a credential after it's been issued (wrong
-- document generated, later found to be invalid, etc). The public verify
-- page needs to reflect this instead of showing a revoked credential as
-- valid forever.
alter table credentials add column if not exists revoked_at timestamptz;
alter table credentials add column if not exists revoked_by uuid references auth.users(id);
alter table credentials add column if not exists revocation_reason text;

create policy "Registrar staff can revoke credentials"
on credentials
for update
using (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
)
with check (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
          and profiles.role = any (array['employee'::user_role, 'registrar_head'::user_role, 'admin'::user_role])
          and profiles.status = 'active'::account_status
    )
);

drop view if exists public_credential_verification;

create view public_credential_verification as
select
    c.credential_number,
    c.status,
    c.generated_at,
    c.released_at,
    dt.document_name,
    dr.request_number,
    trim(concat(p.first_name, ' ', p.last_name)) as student_name,
    col.college_name,
    prog.program_name,
    c.revoked_at,
    c.revocation_reason
from credentials c
join document_types dt on dt.document_type_id = c.document_type_id
join document_requests dr on dr.request_id = c.request_id
join students s on s.student_id = c.student_id
join profiles p on p.user_id = s.user_id
left join colleges col on col.college_id = s.college_id
left join programs prog on prog.program_id = s.program_id;

revoke all on public_credential_verification from anon, authenticated;
grant select on public_credential_verification to anon, authenticated;
