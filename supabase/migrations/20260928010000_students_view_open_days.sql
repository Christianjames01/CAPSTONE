-- Students see the office schedule on their dashboard: Mondays and weekends
-- are closed by default, and staff can mark a specific one open (Office
-- Calendar). Let every signed-in user read office_open_days so the student
-- dashboard can say "Office open on Saturday, Oct 4". Only dates and the
-- staff note are stored there; changes are still staff-only.
--
-- Safe to re-run.

DROP POLICY IF EXISTS "Signed-in users can view open days" ON office_open_days;
CREATE POLICY "Signed-in users can view open days"
    ON office_open_days FOR SELECT
    TO authenticated
    USING (true);
