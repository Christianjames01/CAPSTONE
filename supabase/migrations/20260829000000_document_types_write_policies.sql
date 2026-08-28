-- document_types had RLS enabled with only a SELECT policy, so every
-- INSERT/UPDATE/DELETE from the admin Documents page was silently
-- rejected (0 rows affected, no error) -- fee/name/description edits
-- never actually persisted despite the UI reporting success.
create policy "Registrar head and admin can insert document types"
on public.document_types for insert to authenticated
with check (is_registrar_head());

create policy "Registrar head and admin can update document types"
on public.document_types for update to authenticated
using (is_registrar_head())
with check (is_registrar_head());

create policy "Registrar head and admin can delete document types"
on public.document_types for delete to authenticated
using (is_registrar_head());
