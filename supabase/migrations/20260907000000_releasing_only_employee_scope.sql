-- Adds a restricted "releasing" access scope for employees who should only
-- handle document releasing/claiming, not edit student records or reset
-- student passwords.

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS access_scope text NOT NULL DEFAULT 'full'
    CHECK (access_scope IN ('full', 'releasing'));

CREATE OR REPLACE FUNCTION is_full_access_employee()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.status = 'active'
        AND (
            p.role IN ('registrar_head', 'admin')
            OR (
                p.role = 'employee'
                AND EXISTS (
                    SELECT 1 FROM employees e
                    WHERE e.user_id = p.user_id
                    AND e.access_scope = 'full'
                )
            )
        )
    );
$$;

DROP POLICY IF EXISTS "Employees can update student records" ON students;
CREATE POLICY "Employees can update student records"
    ON students FOR UPDATE
    USING (is_full_access_employee())
    WITH CHECK (is_full_access_employee());

DROP POLICY IF EXISTS "Employees can update student profiles" ON profiles;
CREATE POLICY "Employees can update student profiles"
    ON profiles FOR UPDATE
    USING (
        is_full_access_employee()
        AND EXISTS (SELECT 1 FROM students s WHERE s.user_id = profiles.user_id)
    )
    WITH CHECK (
        is_full_access_employee()
        AND EXISTS (SELECT 1 FROM students s WHERE s.user_id = profiles.user_id)
    );
