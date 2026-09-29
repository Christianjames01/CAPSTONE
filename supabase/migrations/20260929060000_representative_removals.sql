-- Authorized representatives: keep a record when the student removes one, so
-- the head and employees see it on the request (instead of the card just
-- disappearing). The assigned employee is notified and it goes to the
-- activity log.
--
-- Filled by a trigger only; staff can read every removal, a student their own.
-- A representative deleted together with its request is not recorded.
--
-- Safe to re-run.

create table if not exists public.claim_representative_removals (
    removal_id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.document_requests(request_id) on delete cascade,
    student_id uuid,
    full_name text not null,
    relationship text,
    previous_status text,
    removed_by uuid,
    removed_at timestamptz not null default now()
);

create index if not exists claim_representative_removals_request_idx
    on public.claim_representative_removals (request_id, removed_at desc);

alter table public.claim_representative_removals enable row level security;

drop policy if exists "Staff can view representative removals" on public.claim_representative_removals;
create policy "Staff can view representative removals"
on public.claim_representative_removals for select to authenticated
using (public.is_request_staff());

drop policy if exists "Students view their own representative removals" on public.claim_representative_removals;
create policy "Students view their own representative removals"
on public.claim_representative_removals for select to authenticated
using (student_id = public.current_student_id());

grant select on public.claim_representative_removals to authenticated;

create or replace function public.record_claim_representative_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_number text;
    v_employee_user uuid;
begin
    select r.request_number, e.user_id
      into v_request_number, v_employee_user
      from document_requests r
      left join employees e on e.employee_id = r.assigned_employee_id and e.status = 'active'
     where r.request_id = old.request_id;

    -- Deleted together with its request: nothing to record.
    if not found then
        return old;
    end if;

    insert into claim_representative_removals (request_id, student_id, full_name, relationship, previous_status, removed_by)
    values (old.request_id, old.student_id, old.full_name, old.relationship, old.status, auth.uid());

    if v_employee_user is not null and v_employee_user is distinct from auth.uid() then
        insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
        values (
            v_employee_user,
            'Representative removed on ' || coalesce(v_request_number, 'a request'),
            'The student removed ' || old.full_name || coalesce(' (' || old.relationship || ')', '')
                || ' as their representative for ' || coalesce(v_request_number, 'their request')
                || '. Only the student can claim it unless they add a new one.',
            'request_update', old.request_id, false
        );
    end if;

    -- Best effort: never block the removal over the log.
    begin
        insert into activity_logs (user_id, action, table_name, record_id, description)
        values (
            auth.uid(), 'remove_representative', 'claim_representatives', old.request_id,
            'Removed ' || old.full_name || ' as authorized representative for "' || coalesce(v_request_number, old.request_id::text) || '".'
        );
    exception when others then
        raise warning 'representative removal not logged: %', sqlerrm;
    end;

    return old;
end;
$$;

drop trigger if exists trg_record_claim_representative_removal on public.claim_representatives;
create trigger trg_record_claim_representative_removal
after delete on public.claim_representatives
for each row execute function public.record_claim_representative_removal();

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claim_representative_removals'
    ) then
        alter publication supabase_realtime add table public.claim_representative_removals;
    end if;
end;
$$;

notify pgrst, 'reload schema';
