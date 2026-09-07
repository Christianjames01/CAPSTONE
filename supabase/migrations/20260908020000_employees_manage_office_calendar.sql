-- Lets any active employee (not just registrar_head/admin) view AND manage
-- office_open_days and office_events, since the Office Calendar is now also
-- reachable from the employee portal, not just the admin portal.

DROP POLICY IF EXISTS "Registrar head can manage open days" ON office_open_days;
CREATE POLICY "Staff can manage open days"
    ON office_open_days FOR ALL
    USING (is_employee())
    WITH CHECK (is_employee());

DROP POLICY IF EXISTS "Registrar head can manage office events" ON office_events;
CREATE POLICY "Staff can manage office events"
    ON office_events FOR ALL
    USING (is_employee())
    WITH CHECK (is_employee());
