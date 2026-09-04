-- Tracks whether a missed claim schedule has already used its one
-- automatic reschedule (see the mark-missed-claims function). Null means
-- it hasn't yet -- the next miss gets auto-rescheduled to the next
-- business day. Once set, a further miss is left as "missed" for staff
-- to handle manually instead of auto-rescheduling forever.
alter table public.claim_schedules
    add column if not exists auto_rescheduled_at timestamptz;
