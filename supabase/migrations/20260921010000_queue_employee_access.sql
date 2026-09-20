-- Extend walk-in queue management back to plain employees (full-access
-- scope), not just registrar heads/admins. is_employee() already covers
-- employee/registrar_head/admin roles, so it alone is the right check --
-- matching the original pre-admin-only queue policies.
drop policy if exists "Registrar head can view all tickets" on walk_in_queue;
drop policy if exists "Registrar head can add a walk-in ticket" on walk_in_queue;
drop policy if exists "Registrar head can manage tickets" on walk_in_queue;
drop policy if exists "Registrar head can view queue counters" on queue_counters;

create policy "Staff can view all tickets"
    on walk_in_queue for select
    using (is_employee());

create policy "Staff can add a walk-in ticket"
    on walk_in_queue for insert
    with check (is_employee());

create policy "Staff can manage tickets"
    on walk_in_queue for update
    using (is_employee())
    with check (is_employee());

create policy "Staff can view queue counters"
    on queue_counters for select
    using (is_employee());
