-- New student registrations must be manually verified by registrar staff
-- (checked against enrollment records outside this system) before they can
-- use the dashboard or submit requests. Existing students are grandfathered
-- in as already-approved so nobody currently active gets locked out --
-- only accounts created after this migration start "pending".
alter table public.students
add column verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
add column verification_note text,
add column verified_by uuid references auth.users(id),
add column verified_at timestamptz;

update public.students set verification_status = 'approved';
