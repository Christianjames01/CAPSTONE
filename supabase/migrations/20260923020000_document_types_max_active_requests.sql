-- How many active (not yet completed/claimed) requests a student can have
-- at once for a given document type. Was hardcoded to 2 in
-- src/pages/student/NewRequest.jsx with no way to change it per document;
-- defaults to 2 here to keep current behavior unchanged until the
-- registrar head raises it for a specific document type.
alter table public.document_types
    add column if not exists max_active_requests integer not null default 2;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'document_types_max_active_requests_positive'
    ) then
        alter table public.document_types
            add constraint document_types_max_active_requests_positive
            check (max_active_requests > 0);
    end if;
end;
$$;
