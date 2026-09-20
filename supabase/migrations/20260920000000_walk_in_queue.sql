-- Walk-in queue for students who show up at the registrar without a
-- pre-booked claim schedule. Ticket numbers reset each day. A tiny counter
-- table plus an atomic upsert-and-increment function means two students
-- tapping "Get a number" at the same instant can never collide on the same
-- number, without needing a table lock.
create table public.queue_counters (
    queue_date date primary key,
    last_number integer not null default 0
);

create or replace function public.next_queue_number(p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_number integer;
begin
    insert into queue_counters (queue_date, last_number)
    values (p_date, 1)
    on conflict (queue_date)
        do update set last_number = queue_counters.last_number + 1
    returning last_number into v_number;

    return v_number;
end;
$$;

create table public.walk_in_queue (
    queue_id uuid primary key default gen_random_uuid(),
    queue_date date not null default current_date,
    queue_number integer not null,
    student_id uuid not null references public.students(student_id) on delete cascade,
    request_id uuid references public.document_requests(request_id) on delete set null,
    purpose text,
    status text not null default 'waiting'
        check (status in ('waiting', 'called', 'serving', 'completed', 'no_show', 'cancelled')),
    called_at timestamptz,
    served_by uuid references public.employees(employee_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (queue_date, queue_number)
);

create index idx_walk_in_queue_date_status on public.walk_in_queue (queue_date, status);

alter table public.queue_counters enable row level security;
alter table public.walk_in_queue enable row level security;

-- The counter table is purely an internal sequencing detail written only
-- via the SECURITY DEFINER function above -- staff can read it for
-- diagnostics, but nothing needs to insert/update it directly.
create policy "Staff can view queue counters"
    on queue_counters for select
    using (is_employee());

create policy "Students can view their own tickets"
    on walk_in_queue for select
    using (student_id in (select student_id from students where user_id = auth.uid()));

create policy "Students can create their own tickets"
    on walk_in_queue for insert
    with check (student_id in (select student_id from students where user_id = auth.uid()));

-- A student can only ever move their own ticket from waiting to cancelled --
-- everything else (calling, serving, completing, no-show) is staff-only.
create policy "Students can cancel their own waiting ticket"
    on walk_in_queue for update
    using (
        status = 'waiting'
        and student_id in (select student_id from students where user_id = auth.uid())
    )
    with check (
        status = 'cancelled'
        and student_id in (select student_id from students where user_id = auth.uid())
    );

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
