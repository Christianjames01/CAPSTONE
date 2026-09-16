-- ONE-OFF RESET SCRIPT -- NOT a migration. Do not put this in
-- supabase/migrations and do not run it via `supabase db push`: a
-- destructive script like this must never be replayed automatically
-- against a future/fresh environment.
--
-- Run this ONCE, by pasting it into the Supabase Dashboard -> SQL Editor
-- for this project (confirm the project ref matches this app's
-- VITE_SUPABASE_URL in certichain/.env before running -- itirvcydvaujbrwbuctc),
-- while signed in as the project owner (needed for the auth.users
-- delete below -- the public anon/service REST API cannot do that
-- part).
--
-- Written as a single PL/pgSQL DO block -- syntactically ONE
-- statement, so nothing can be split across separate connections the
-- way earlier attempts using multiple top-level statements were.
--
-- v2 of this script (previous version in git history) derived "who is
-- a student/employee" by joining profiles.role to students/employees.
-- That missed a students row with no matching profiles row at all
-- (almost certainly added directly by staff -- e.g. a walk-in
-- pre-registration via the admin Students/StudentHistory "add
-- student" form -- rather than through self-signup), which silently
-- survived a full reset run. This version instead treats students/
-- document_requests/etc. as unconditionally per-student data (no
-- head/admin account can ever own a row there, so no filter is
-- needed), and everywhere else deletes "everyone except the protected
-- head/admin account(s)" instead of "everyone matching role X" -- so
-- a missing/mismatched profile link can no longer hide anything from
-- the wipe.
--
-- Full system renewal: wipes every student AND every employee
-- account, all document requests, and everything hanging off them,
-- then restarts the request/credential numbering at 1. Only accounts
-- with profiles.role in ('registrar_head', 'admin') survive.
--
-- What gets deleted:
--   - Every row in students, document_requests, and everything
--     hanging off them: request_requirements, official_receipts,
--     claim_schedules, credentials, released_credentials, exit_slips.
--     Unconditional -- these tables cannot contain head/admin data.
--   - Every employees row not linked to a protected head/admin
--     profile (covers a normal employee, and any orphaned employees
--     row with a missing/wrong profile link).
--   - Messages, notifications, and office_events/office_open_days not
--     belonging to a protected head/admin account.
--   - Every profiles and auth.users row except the protected
--     head/admin account(s).
--   - The entire activity_logs table, cleared out completely.
--   - request_ratings, student_grades, and academic_records are not
--     touched explicitly -- all three have `on delete cascade` back to
--     students, so they disappear automatically.
--
-- NOT deleted: storage.objects (uploaded requirement files, receipts,
-- avatars). Supabase blocks raw DELETE on that table with
-- storage.protect_delete(), even for the table owner. Those files
-- become unreferenced once the rows above are gone; clear them
-- afterward via Dashboard -> Storage if you want the space back.
--
-- Also resets request_number_seq and credential_number_seq back to 1.
--
-- Before running: this is irreversible outside of a database backup.
-- This wipes ALL students and ALL employees, with no exceptions
-- beyond the head/admin account(s). If that's not what you want, stop
-- and say so before running this.

do $$
declare
    v_protected_user_ids uuid[];
begin
    select coalesce(array_agg(user_id), array[]::uuid[]) into v_protected_user_ids
    from profiles where role in ('registrar_head', 'admin');

    -- Unconditional: no head/admin account can ever own a row in any
    -- of these tables, so there's nothing to filter.
    delete from released_credentials;
    delete from exit_slips;
    delete from request_requirements;
    delete from official_receipts;
    delete from claim_schedules;
    delete from credentials;
    delete from document_requests;
    delete from students;

    -- Everything else: keep only rows belonging to a protected
    -- head/admin account; delete everything else, including rows with
    -- a null/missing link (those can't belong to a protected account
    -- either, so they're purge targets too).
    delete from messages
    where sender_user_id is null or sender_user_id <> all(v_protected_user_ids)
       or receiver_user_id is null or receiver_user_id <> all(v_protected_user_ids);

    delete from notifications
    where user_id is null or user_id <> all(v_protected_user_ids);

    delete from office_events
    where created_by is null or created_by <> all(v_protected_user_ids);

    delete from office_open_days
    where created_by is null or created_by <> all(v_protected_user_ids);

    delete from employees
    where user_id is null or user_id <> all(v_protected_user_ids);

    delete from profiles
    where user_id <> all(v_protected_user_ids);

    delete from auth.users
    where id <> all(v_protected_user_ids);

    delete from activity_logs;

    alter sequence request_number_seq restart with 1;
    alter sequence credential_number_seq restart with 1;
end $$;
