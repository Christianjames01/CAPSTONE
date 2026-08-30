-- Only the head/admin (is_registrar_head()) could see document_types
-- rows where is_available = false; regular employees could only see
-- available ones. Harmless today (no document type is currently
-- disabled), but the moment one is, any employee viewing a request for
-- that document type loses the document name (falls back to "Document")
-- since the join silently returns nothing. Document type names/fees
-- aren't sensitive, so extend visibility to any active employee.
create policy "Employees can view all document types"
on document_types
for select
using (is_employee());
