-- The landing page's Document Catalog now reads document_types live, so the
-- registrar head's edits, additions, deletions, and availability changes
-- show up there. Visitors aren't signed in (anon), and document_types only
-- had SELECT policies for authenticated users, so they saw nothing.
--
-- The catalog is public information; only available documents are exposed.

drop policy if exists "Anyone can view available document types" on public.document_types;

create policy "Anyone can view available document types"
on public.document_types
for select
to anon
using (is_available = true);

notify pgrst, 'reload schema';
