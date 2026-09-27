-- Office hours on days the office is open, e.g. 8:00 AM - 5:00 PM.
--   - office_open_days: set by the head or an employee when marking a
--     Monday/weekend open in the Office Calendar.
--   - announcements: set on an "Office open" (dated, not closed) notice.
-- Students see the hours on their dashboard. Both are optional.
--
-- Safe to re-run.

ALTER TABLE office_open_days ADD COLUMN IF NOT EXISTS open_time time;
ALTER TABLE office_open_days ADD COLUMN IF NOT EXISTS close_time time;

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS open_time time;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS close_time time;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'office_open_days_hours_order') THEN
        ALTER TABLE office_open_days ADD CONSTRAINT office_open_days_hours_order
            CHECK (open_time IS NULL OR close_time IS NULL OR open_time < close_time);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_hours_order') THEN
        ALTER TABLE announcements ADD CONSTRAINT announcements_hours_order
            CHECK (open_time IS NULL OR close_time IS NULL OR open_time < close_time);
    END IF;
END;
$$;
