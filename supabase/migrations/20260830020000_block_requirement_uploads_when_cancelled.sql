-- Students should not be able to upload/update requirements for a
-- request that has been cancelled.
drop policy if exists "Students can update their own request requirements" on request_requirements;
drop policy if exists "Students can insert requirements for their own requests" on request_requirements;

create policy "Students can update their own request requirements"
on request_requirements
for update
using (
    exists (
        select 1
        from document_requests dr
        join students s on s.student_id = dr.student_id
        where dr.request_id = request_requirements.request_id
          and s.user_id = auth.uid()
          and dr.status <> 'cancelled'
    )
)
with check (
    exists (
        select 1
        from document_requests dr
        join students s on s.student_id = dr.student_id
        where dr.request_id = request_requirements.request_id
          and s.user_id = auth.uid()
          and dr.status <> 'cancelled'
    )
);

create policy "Students can insert requirements for their own requests"
on request_requirements
for insert
with check (
    exists (
        select 1
        from document_requests dr
        join students s on s.student_id = dr.student_id
        where dr.request_id = request_requirements.request_id
          and s.user_id = auth.uid()
          and dr.status <> 'cancelled'
    )
);
