-- Claiming by an authorized representative.
--
-- A student who can't claim in person names a representative for a request
-- and uploads a signed authorization letter plus the representative's valid
-- ID. Staff review it (approve / not approve with a reason); the release
-- window then sees exactly who is allowed to claim the document.
--
-- One representative per request. Files live in the private
-- 'claim-authorizations' bucket under <student_id>/<request_id>/..., the
-- same ownership scheme as official-receipts.

create table if not exists public.claim_representatives (
    representative_id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique references public.document_requests(request_id) on delete cascade,
    student_id uuid not null references public.students(student_id) on delete cascade,
    full_name text not null check (length(btrim(full_name)) between 2 and 120),
    relationship text not null check (length(btrim(relationship)) between 1 and 60),
    contact_number text check (contact_number is null or length(contact_number) <= 30),
    authorization_letter_path text not null,
    valid_id_path text not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_note text check (review_note is null or length(review_note) <= 500),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists claim_representatives_student_idx on public.claim_representatives (student_id);

-- Same helper as 20260926000000_request_notes (re-declared so this file
-- stands on its own).
create or replace function public.is_request_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from profiles
        where user_id = auth.uid()
          and role in ('employee', 'registrar_head', 'admin')
    );
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select student_id from students where user_id = auth.uid() limit 1;
$$;

revoke execute on function public.current_student_id() from public, anon;
grant execute on function public.current_student_id() to authenticated;

-- Students can only submit/replace (always back to 'pending'); only staff
-- can approve or reject, and the reviewer is stamped automatically.
create or replace function public.guard_claim_representative()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := now();

    if public.is_request_staff() then
        if tg_op = 'UPDATE' and new.status is distinct from old.status then
            new.reviewed_by := auth.uid();
            new.reviewed_at := now();
        end if;
        return new;
    end if;

    -- Student path.
    if tg_op = 'UPDATE' then
        new.request_id := old.request_id;
        new.student_id := old.student_id;
        new.created_at := old.created_at;
    end if;
    new.status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
end;
$$;

drop trigger if exists trg_guard_claim_representative on public.claim_representatives;
create trigger trg_guard_claim_representative
before insert or update on public.claim_representatives
for each row execute function public.guard_claim_representative();

alter table public.claim_representatives enable row level security;

drop policy if exists "Students manage their own representatives" on public.claim_representatives;
create policy "Students manage their own representatives"
on public.claim_representatives for all to authenticated
using (student_id = public.current_student_id())
with check (
    student_id = public.current_student_id()
    and exists (
        select 1 from document_requests r
        where r.request_id = claim_representatives.request_id
          and r.student_id = public.current_student_id()
    )
);

drop policy if exists "Staff can view representatives" on public.claim_representatives;
create policy "Staff can view representatives"
on public.claim_representatives for select to authenticated
using (public.is_request_staff());

drop policy if exists "Staff can review representatives" on public.claim_representatives;
create policy "Staff can review representatives"
on public.claim_representatives for update to authenticated
using (public.is_request_staff())
with check (public.is_request_staff());

grant select, insert, update, delete on public.claim_representatives to authenticated;

-- Notifications: the assigned employee hears about a new/replaced
-- submission; the student hears about the review result.
create or replace function public.notify_claim_representative_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_number text;
    v_employee_user uuid;
    v_student_user uuid;
begin
    select r.request_number, e.user_id
    into v_request_number, v_employee_user
    from document_requests r
    left join employees e on e.employee_id = r.assigned_employee_id and e.status = 'active'
    where r.request_id = new.request_id;

    if new.status = 'pending'
       and (tg_op = 'INSERT' or new.full_name is distinct from old.full_name
            or new.authorization_letter_path is distinct from old.authorization_letter_path
            or new.valid_id_path is distinct from old.valid_id_path
            or old.status <> 'pending') then
        if v_employee_user is not null then
            insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                v_employee_user,
                'Representative to review on ' || coalesce(v_request_number, 'a request'),
                'The student authorized ' || new.full_name || ' (' || new.relationship || ') to claim '
                    || coalesce(v_request_number, 'their request') || '. Please review the letter and ID.',
                'request_update', new.request_id, false
            );
        end if;
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
        select user_id into v_student_user from students where student_id = new.student_id;
        if v_student_user is not null then
            insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                v_student_user,
                case when new.status = 'approved'
                    then 'Representative approved'
                    else 'Representative not approved' end,
                case when new.status = 'approved'
                    then new.full_name || ' may claim ' || coalesce(v_request_number, 'your request')
                         || ' for you. They must bring the original signed authorization letter and their valid ID.'
                    else 'Your representative for ' || coalesce(v_request_number, 'your request') || ' was not approved'
                         || coalesce(': ' || nullif(btrim(new.review_note), ''), '.') || ' You can submit a new one.' end,
                'request_update', new.request_id, false
            );
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_notify_claim_representative_change on public.claim_representatives;
create trigger trg_notify_claim_representative_change
after insert or update on public.claim_representatives
for each row execute function public.notify_claim_representative_change();

-- Private bucket for the letters and IDs (5 MB, images or PDF).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-authorizations', 'claim-authorizations', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "Claim authorizations: owner or staff can view" on storage.objects;
create policy "Claim authorizations: owner or staff can view"
on storage.objects for select to authenticated
using (
    bucket_id = 'claim-authorizations'
    and (
        (storage.foldername(name))[1] = public.current_student_id()::text
        or public.is_request_staff()
    )
);

drop policy if exists "Claim authorizations: students upload their own" on storage.objects;
create policy "Claim authorizations: students upload their own"
on storage.objects for insert to authenticated
with check (
    bucket_id = 'claim-authorizations'
    and (storage.foldername(name))[1] = public.current_student_id()::text
);

drop policy if exists "Claim authorizations: students delete their own" on storage.objects;
create policy "Claim authorizations: students delete their own"
on storage.objects for delete to authenticated
using (
    bucket_id = 'claim-authorizations'
    and (storage.foldername(name))[1] = public.current_student_id()::text
);

-- Live updates on request pages and the release window.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claim_representatives'
    ) then
        alter publication supabase_realtime add table public.claim_representatives;
    end if;
end;
$$;

notify pgrst, 'reload schema';
