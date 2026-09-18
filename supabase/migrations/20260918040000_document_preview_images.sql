-- Lets the registrar head attach a sample image to a document type (e.g. a
-- blank/sample scan of what an actual Transcript of Records looks like),
-- shown to students when they're choosing a document type on New Request
-- so they can see the real thing before they submit a request for it.
alter table public.document_types
    add column if not exists preview_image_url text;

insert into storage.buckets (id, name, public)
values ('document-previews', 'document-previews', true)
on conflict (id) do nothing;

-- Public bucket -- these are sample/template images, not filled-in student
-- records, so there's nothing sensitive to protect by requiring auth to
-- view them (mirrors the existing public "avatars" bucket).
create policy "Document preview images are publicly viewable"
on storage.objects
for select
to public
using (bucket_id = 'document-previews');

create policy "Registrar head can upload document preview images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'document-previews' and is_registrar_head());

create policy "Registrar head can update document preview images"
on storage.objects
for update
to authenticated
using (bucket_id = 'document-previews' and is_registrar_head())
with check (bucket_id = 'document-previews' and is_registrar_head());

create policy "Registrar head can delete document preview images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'document-previews' and is_registrar_head());
