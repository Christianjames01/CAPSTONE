-- Keep every reschedule request a student sends, instead of one
-- reschedule_reason that staff wipe when they pick a new date (and a new
-- request overwrites). The claim schedule page shows the full history:
-- each message, when it was sent, and whether/how it was handled.
--
-- claim_schedules.reschedule_requested_at/reason keep working as the
-- "currently pending" flag the lists and dashboards read.

create table if not exists public.claim_reschedule_requests (
    reschedule_request_id uuid primary key default gen_random_uuid(),
    claim_schedule_id uuid not null references public.claim_schedules(claim_schedule_id) on delete cascade,
    reason text,
    requested_at timestamptz not null default now(),
    handled_at timestamptz,
    new_claim_date date,
    new_claim_time time
);

create index if not exists claim_reschedule_requests_schedule_idx
    on public.claim_reschedule_requests (claim_schedule_id, requested_at);

alter table public.claim_reschedule_requests enable row level security;

-- Staff read all; students read their own. Rows are only written by the
-- functions below, never directly by the app.
drop policy if exists "Staff can view reschedule requests" on public.claim_reschedule_requests;
create policy "Staff can view reschedule requests"
on public.claim_reschedule_requests
for select
to authenticated
using (is_employee() or is_registrar_head());

drop policy if exists "Students can view their own reschedule requests" on public.claim_reschedule_requests;
create policy "Students can view their own reschedule requests"
on public.claim_reschedule_requests
for select
to authenticated
using (exists (
    select 1
    from claim_schedules cs
    join students s on s.student_id = cs.student_id
    where cs.claim_schedule_id = claim_reschedule_requests.claim_schedule_id
      and s.user_id = auth.uid()
));

-- Same checks as before, plus a history row.
create or replace function public.request_claim_reschedule(p_claim_schedule_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owns boolean;
begin
    select exists (
        select 1
        from claim_schedules cs
        join students s on s.student_id = cs.student_id
        where cs.claim_schedule_id = p_claim_schedule_id
          and s.user_id = auth.uid()
          and cs.status in ('scheduled', 'missed')
          and cs.reschedule_requested_at is null
    ) into v_owns;

    if not v_owns then
        raise exception 'Reschedule request is not allowed for this claim schedule.';
    end if;

    update claim_schedules
    set reschedule_requested_at = now(),
        reschedule_reason = p_reason
    where claim_schedule_id = p_claim_schedule_id;

    insert into claim_reschedule_requests (claim_schedule_id, reason)
    values (p_claim_schedule_id, p_reason);
end;
$$;

grant execute on function public.request_claim_reschedule(uuid, text) to authenticated;

-- When staff save a new date, the app clears reschedule_requested_at. Mark
-- the open request(s) handled -- with the new date/time -- instead of
-- losing them.
create or replace function public.mark_reschedule_requests_handled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if old.reschedule_requested_at is not null and new.reschedule_requested_at is null then
        update claim_reschedule_requests
        set handled_at = now(),
            new_claim_date = coalesce(new.claim_date, new.scheduled_date),
            new_claim_time = coalesce(new.claim_time, new.scheduled_time)
        where claim_schedule_id = new.claim_schedule_id
          and handled_at is null;
    end if;
    return new;
end;
$$;

revoke execute on function public.mark_reschedule_requests_handled() from public, anon, authenticated;

drop trigger if exists trg_mark_reschedule_requests_handled on public.claim_schedules;
create trigger trg_mark_reschedule_requests_handled
after update of reschedule_requested_at on public.claim_schedules
for each row
execute function public.mark_reschedule_requests_handled();

-- Backfill requests that are pending right now (handled ones were already
-- wiped by the old behavior and can't be recovered).
insert into public.claim_reschedule_requests (claim_schedule_id, reason, requested_at)
select cs.claim_schedule_id, cs.reschedule_reason, cs.reschedule_requested_at
from public.claim_schedules cs
where cs.reschedule_requested_at is not null
  and not exists (
      select 1 from public.claim_reschedule_requests r
      where r.claim_schedule_id = cs.claim_schedule_id and r.handled_at is null
  );

notify pgrst, 'reload schema';
