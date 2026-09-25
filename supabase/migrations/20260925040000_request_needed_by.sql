-- Priority that means something:
--   * students can say when they need the document ("needed by") and why;
--   * staff (registrar head / assigned employee) mark requests urgent, which
--     already exists as document_requests.priority ('normal' | 'urgent');
--   * request lists sort urgent first, then by the nearest needed-by date,
--     and flag "Due soon" / "Overdue".

alter table public.document_requests add column if not exists needed_by date;
alter table public.document_requests add column if not exists needed_by_reason text;

notify pgrst, 'reload schema';
