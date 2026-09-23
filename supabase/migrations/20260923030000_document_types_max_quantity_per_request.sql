-- How many copies of a document a student can request in a single
-- submission. Was hardcoded to 2 in src/pages/student/NewRequest.jsx
-- (separate from max_active_requests, which caps how many *separate*
-- requests can be open at once) with no way to change it per document.
-- Defaults to 2 to keep current behavior unchanged until the registrar
-- head raises it for a specific document type.
alter table public.document_types
    add column if not exists max_quantity_per_request integer not null default 2;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'document_types_max_quantity_per_request_positive'
    ) then
        alter table public.document_types
            add constraint document_types_max_quantity_per_request_positive
            check (max_quantity_per_request > 0);
    end if;
end;
$$;
