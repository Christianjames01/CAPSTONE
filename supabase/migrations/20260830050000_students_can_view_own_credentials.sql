-- Students had no SELECT policy on credentials at all, so they could
-- never see their own generated digital credential (needed to show its
-- verify-QR on their request details page).
create policy "Students can view their own credentials"
on credentials
for select
using (
    student_id in (
        select students.student_id
        from students
        where students.user_id = auth.uid()
    )
);
