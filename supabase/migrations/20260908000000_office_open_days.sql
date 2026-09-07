-- Lets the Registrar Head mark specific weekend dates (e.g. a Saturday
-- during enrollment) as days the office is actually open, so the
-- auto-reschedule job for missed claims can offer those dates instead of
-- always skipping to the next Monday.

CREATE TABLE IF NOT EXISTS office_open_days (
    open_day_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    open_date date NOT NULL UNIQUE,
    note text,
    created_by uuid REFERENCES profiles(user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE office_open_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view open days"
    ON office_open_days FOR SELECT
    USING (is_employee());

CREATE POLICY "Registrar head can manage open days"
    ON office_open_days FOR ALL
    USING (is_registrar_head())
    WITH CHECK (is_registrar_head());
