-- The registrar head wants to post announcements that show up on the
-- student dashboard, the employee dashboard, and (optionally) the public
-- landing page. Visibility is controlled per-announcement via three flags
-- rather than a single audience column, since a notice can target more
-- than one audience at once.

create table public.announcements (
    announcement_id uuid primary key default gen_random_uuid(),
    title text not null,
    message text not null,
    show_to_students boolean not null default true,
    show_to_employees boolean not null default true,
    show_to_public boolean not null default false,
    is_active boolean not null default true,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- The landing page is unauthenticated, so anon needs read access to the
-- subset of announcements explicitly marked public.
create policy "Anyone can view active public announcements"
on public.announcements
for select
to public
using (is_active and show_to_public);

-- Logged-in users (student/employee/admin dashboards) can see any active
-- announcement; each dashboard filters client-side by its own
-- show_to_students / show_to_employees flag.
create policy "Authenticated users can view active announcements"
on public.announcements
for select
to authenticated
using (is_active);

-- The head also needs to see inactive/draft announcements to manage them,
-- not just the active ones the other policies expose.
create policy "Registrar head and admin can view all announcements"
on public.announcements
for select
to authenticated
using (is_registrar_head());

create policy "Registrar head and admin can insert announcements"
on public.announcements
for insert
to authenticated
with check (is_registrar_head());

create policy "Registrar head and admin can update announcements"
on public.announcements
for update
to authenticated
using (is_registrar_head())
with check (is_registrar_head());

create policy "Registrar head and admin can delete announcements"
on public.announcements
for delete
to authenticated
using (is_registrar_head());
