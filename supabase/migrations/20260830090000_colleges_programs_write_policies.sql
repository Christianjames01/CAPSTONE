-- colleges and programs had SELECT-only policies -- no INSERT, UPDATE, or
-- DELETE policy existed at all, so every "Add College", "Edit College",
-- "Add Program", and status-toggle action in admin/CollegesPrograms.jsx
-- has been silently failing (UPDATE) or erroring (INSERT) since these
-- tables were created. Same bug class as the earlier document_types fix.
create policy "Registrar head and admin can insert colleges"
on colleges
for insert
with check (is_registrar_head());

create policy "Registrar head and admin can update colleges"
on colleges
for update
using (is_registrar_head())
with check (is_registrar_head());

create policy "Registrar head and admin can delete colleges"
on colleges
for delete
using (is_registrar_head());

create policy "Registrar head and admin can insert programs"
on programs
for insert
with check (is_registrar_head());

create policy "Registrar head and admin can update programs"
on programs
for update
using (is_registrar_head())
with check (is_registrar_head());

create policy "Registrar head and admin can delete programs"
on programs
for delete
using (is_registrar_head());
