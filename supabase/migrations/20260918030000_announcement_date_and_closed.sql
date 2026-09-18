-- Lets an announcement be pinned to a specific date and say whether the
-- registrar office is closed or open that day (e.g. "September 20 —
-- Office Closed for a Holiday"), instead of only free-text title/message.
-- Both are optional -- an announcement with no date behaves exactly as
-- before.
alter table public.announcements
    add column if not exists announcement_date date,
    add column if not exists is_closed boolean not null default false;
