-- Simplify to a plain numbered-ticket queue: the head just issues the next
-- number when someone walks in, no need to look up a student account
-- first. student_id becomes optional (still settable later if a ticket
-- should be tied to a request), and an optional plain-text visitor_name
-- lets the head jot down who a number belongs to for their own reference,
-- without requiring an actual student record.
alter table public.walk_in_queue
    alter column student_id drop not null,
    add column if not exists visitor_name text;
