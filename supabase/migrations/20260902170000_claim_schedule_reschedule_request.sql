-- Tracks whether a student already asked to reschedule this claim schedule,
-- so the "Request reschedule" button can disable itself instead of letting
-- them spam the same request repeatedly. Cleared when staff actually
-- reschedules it (employee/ClaimSchedule.jsx's update path).
alter table public.claim_schedules
    add column if not exists reschedule_requested_at timestamptz,
    add column if not exists reschedule_reason text;
