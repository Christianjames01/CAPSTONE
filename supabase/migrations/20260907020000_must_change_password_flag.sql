-- Flags an account as needing a forced password change on next login,
-- used when staff set a password on someone else's behalf (new employee
-- accounts, student password resets) rather than the user choosing it.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
