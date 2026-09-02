-- official-receipts storage policies had no ownership scoping at all --
-- any authenticated user (including any other student) could view,
-- overwrite, or delete ANY other student's payment receipt, since every
-- policy only checked bucket_id = 'official-receipts'. Verified exploitable
-- via RLS impersonation before this fix. Rescoped to match the pattern
-- already used correctly for the student-requirements bucket: the file's
-- first path segment is the uploading student's student_id.

drop policy if exists "Authenticated users can view official receipts" on storage.objects;
drop policy if exists "Authenticated users can upload official receipts" on storage.objects;
drop policy if exists "Authenticated users can update official receipts" on storage.objects;
drop policy if exists "Authenticated users can delete official receipts" on storage.objects;

create policy "Students can view their own official receipts"
on storage.objects for select
to authenticated
using (
    bucket_id = 'official-receipts'
    and (
        (storage.foldername(name))[1] = (
            select students.student_id::text from students where students.user_id = auth.uid()
        )
        or exists (
            select 1 from employees where employees.user_id = auth.uid() and employees.status = 'active'
        )
        or exists (
            select 1 from profiles
            where profiles.user_id = auth.uid()
              and profiles.role in ('registrar_head', 'admin')
              and profiles.status = 'active'
        )
    )
);

create policy "Students can upload their own official receipts"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'official-receipts'
    and (storage.foldername(name))[1] = (
        select students.student_id::text from students where students.user_id = auth.uid()
    )
);

create policy "Students can update their own official receipts"
on storage.objects for update
to authenticated
using (
    bucket_id = 'official-receipts'
    and (storage.foldername(name))[1] = (
        select students.student_id::text from students where students.user_id = auth.uid()
    )
)
with check (
    bucket_id = 'official-receipts'
    and (storage.foldername(name))[1] = (
        select students.student_id::text from students where students.user_id = auth.uid()
    )
);

create policy "Students can delete their own official receipts"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'official-receipts'
    and (storage.foldername(name))[1] = (
        select students.student_id::text from students where students.user_id = auth.uid()
    )
);
