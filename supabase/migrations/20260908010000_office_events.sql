-- Lets the Registrar Head add informational notes/events to any day on the
-- Office Calendar (e.g. "Enrollment Week", "Staff Seminar"), separate from
-- office_open_days. These are purely informational -- they do not affect
-- the missed-claim auto-reschedule logic, which only cares about
-- office_open_days for weekend eligibility.

CREATE TABLE IF NOT EXISTS office_events (
    event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date date NOT NULL,
    title text NOT NULL,
    note text,
    created_by uuid REFERENCES profiles(user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE office_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view office events"
    ON office_events FOR SELECT
    USING (is_employee());

CREATE POLICY "Registrar head can manage office events"
    ON office_events FOR ALL
    USING (is_registrar_head())
    WITH CHECK (is_registrar_head());
