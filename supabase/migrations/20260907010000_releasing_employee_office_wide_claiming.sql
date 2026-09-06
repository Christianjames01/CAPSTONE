-- Releasing is a front-desk job: an employee with access_scope='releasing'
-- needs to schedule/reschedule/mark-claimed any request that has reached the
-- claiming stage, regardless of which employee it's assigned to. This adds a
-- narrowly-scoped UPDATE policy so that access only covers claiming-stage
-- status transitions, not the full processing workflow.

CREATE OR REPLACE FUNCTION is_releasing_employee()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM profiles p
        JOIN employees e ON e.user_id = p.user_id
        WHERE p.user_id = auth.uid()
        AND p.status = 'active'
        AND p.role = 'employee'
        AND e.access_scope = 'releasing'
    );
$$;

DROP POLICY IF EXISTS "Releasing employees can update claiming-stage requests" ON document_requests;
CREATE POLICY "Releasing employees can update claiming-stage requests"
    ON document_requests FOR UPDATE
    USING (
        status IN ('ready_for_claiming', 'scheduled', 'claimed')
        AND is_releasing_employee()
    )
    WITH CHECK (
        status IN ('ready_for_claiming', 'scheduled', 'claimed', 'completed')
        AND is_releasing_employee()
    );
