-- Internal staff notes on a request, e.g. "Assigned employee is absent this
-- week -- Maria is covering", "Student called, will pay on Friday".
--
-- Staff-only: employees, the registrar head and admins can read and add
-- notes; students can never see them (unlike document_requests
-- .employee_remarks, which is shown to the student). Authors can edit or
-- delete their own notes; the head/admin can delete any. The author's name
-- and role are stamped by the database so they can't be faked.

create table if not exists public.request_notes (
    note_id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.document_requests(request_id) on delete cascade,
    author_user_id uuid references auth.users(id) on delete set null,
    author_name text,
    author_role text,
    category text not null default 'general'
        check (category in ('general', 'absence', 'follow_up', 'issue')),
    body text not null check (length(btrim(body)) between 1 and 2000),
    is_pinned boolean not null default false,
    created_at timestamptz not null default now(),
    edited_at timestamptz
);

create index if not exists request_notes_request_idx
    on public.request_notes (request_id, created_at desc);

-- Is the current user staff (employee, registrar head or admin)?
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

create or replace function public.is_registrar_head_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from profiles
        where user_id = auth.uid()
          and role in ('registrar_head', 'admin')
    );
$$;

revoke execute on function public.is_request_staff() from public, anon;
revoke execute on function public.is_registrar_head_or_admin() from public, anon;
grant execute on function public.is_request_staff() to authenticated;
grant execute on function public.is_registrar_head_or_admin() to authenticated;

-- Stamp author details on insert; on update keep them fixed and record the
-- edit time (pinning alone isn't an edit).
create or replace function public.stamp_request_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text;
    v_role text;
begin
    if tg_op = 'INSERT' then
        select
            coalesce(nullif(btrim(e.display_name), ''), nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Staff'),
            p.role::text
        into v_name, v_role
        from profiles p
        left join employees e on e.user_id = p.user_id
        where p.user_id = auth.uid()
        limit 1;

        new.author_user_id := auth.uid();
        new.author_name := coalesce(v_name, 'Staff');
        new.author_role := v_role;
        new.created_at := now();
        new.edited_at := null;
    else
        new.author_user_id := old.author_user_id;
        new.author_name := old.author_name;
        new.author_role := old.author_role;
        new.created_at := old.created_at;
        new.request_id := old.request_id;
        if new.body is distinct from old.body or new.category is distinct from old.category then
            new.edited_at := now();
        else
            new.edited_at := old.edited_at;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_stamp_request_note on public.request_notes;
create trigger trg_stamp_request_note
before insert or update on public.request_notes
for each row execute function public.stamp_request_note();

alter table public.request_notes enable row level security;

drop policy if exists "Staff can read request notes" on public.request_notes;
create policy "Staff can read request notes"
on public.request_notes for select to authenticated
using (public.is_request_staff());

drop policy if exists "Staff can add request notes" on public.request_notes;
create policy "Staff can add request notes"
on public.request_notes for insert to authenticated
with check (public.is_request_staff());

-- Any staff member may update (so anyone can pin/unpin); the
-- guard_request_note_edit trigger below limits text changes to the author.
drop policy if exists "Staff can update request notes" on public.request_notes;
create policy "Staff can update request notes"
on public.request_notes for update to authenticated
using (public.is_request_staff())
with check (public.is_request_staff());

drop policy if exists "Authors and the head can delete request notes" on public.request_notes;
create policy "Authors and the head can delete request notes"
on public.request_notes for delete to authenticated
using (author_user_id = auth.uid() or public.is_registrar_head_or_admin());

-- Only the author may change a note's text or category; other staff can
-- only pin/unpin it.
create or replace function public.guard_request_note_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if (new.body is distinct from old.body or new.category is distinct from old.category)
       and old.author_user_id is distinct from auth.uid() then
        raise exception 'Only the author can edit this note.' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_guard_request_note_edit on public.request_notes;
create trigger trg_guard_request_note_edit
before update on public.request_notes
for each row execute function public.guard_request_note_edit();

grant select, insert, update, delete on public.request_notes to authenticated;

-- Live updates on the request page (see 20260925080000_realtime_requests).
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'request_notes'
    ) then
        alter publication supabase_realtime add table public.request_notes;
    end if;
end;
$$;

notify pgrst, 'reload schema';
