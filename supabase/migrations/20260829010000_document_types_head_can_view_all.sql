-- The only SELECT policy on document_types is "is_available = true",
-- meant to hide unavailable documents from students/employees browsing.
-- That same restrictive policy blocked registrar staff from managing
-- availability at all: toggling a document to unavailable makes the
-- updated row fail that SELECT check, which Postgres surfaces as
-- "new row violates row-level security policy" on the UPDATE. It also
-- silently hid already-unavailable documents from the admin's own list.
create policy "Registrar head and admin can view all document types"
on public.document_types for select
to authenticated
using (is_registrar_head());
