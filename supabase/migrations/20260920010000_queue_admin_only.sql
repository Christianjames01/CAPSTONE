-- The walk-in queue turned out to be registrar-head/admin only -- no
-- student self-service ticket, and no plain-employee access either; staff
-- running the counter now manage this exclusively through the admin
-- portal. Drop the student- and employee-facing policies and replace the
-- employee-scoped staff policies with registrar-head-only ones.
drop policy if exists "Students can view their own tickets" on walk_in_queue;
drop policy if exists "Students can create their own tickets" on walk_in_queue;
drop policy if exists "Students can cancel their own waiting ticket" on walk_in_queue;
drop policy if exists "Staff can view all tickets" on walk_in_queue;
drop policy if exists "Staff can add a walk-in ticket" on walk_in_queue;
drop policy if exists "Staff can manage tickets" on walk_in_queue;
drop policy if exists "Staff can view queue counters" on queue_counters;

create policy "Registrar head can view all tickets"
    on walk_in_queue for select
    using (is_registrar_head());

create policy "Registrar head can add a walk-in ticket"
    on walk_in_queue for insert
    with check (is_registrar_head());

create policy "Registrar head can manage tickets"
    on walk_in_queue for update
    using (is_registrar_head())
    with check (is_registrar_head());

create policy "Registrar head can view queue counters"
    on queue_counters for select
    using (is_registrar_head());
