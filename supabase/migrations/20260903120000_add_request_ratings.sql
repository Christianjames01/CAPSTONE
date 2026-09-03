-- Students had no way to rate a completed request, so there was no
-- satisfaction signal to report on alongside the turnaround/performance
-- metrics Reports.jsx already computes. One rating per request: a 1-5
-- score plus an optional comment, insertable only by the owning student
-- and only once the request is completed.

create table public.request_ratings (
    rating_id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.document_requests(request_id) on delete cascade,
    student_id uuid not null references public.students(student_id) on delete cascade,
    rating smallint not null check (rating between 1 and 5),
    comment text,
    created_at timestamptz not null default now(),
    unique (request_id)
);

alter table public.request_ratings enable row level security;

create policy "Students can rate their own completed requests"
on public.request_ratings
for insert
to authenticated
with check (
    student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
    )
    and exists (
        select 1 from public.document_requests dr
        where dr.request_id = request_ratings.request_id
          and dr.student_id = request_ratings.student_id
          and dr.status = 'completed'
    )
);

create policy "Students can view their own ratings"
on public.request_ratings
for select
to authenticated
using (
    student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
    )
);

create policy "Employees can view all ratings"
on public.request_ratings
for select
to authenticated
using (public.is_employee());
