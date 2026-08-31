-- Records why and when a student cancelled their own request.
alter table public.document_requests
    add column if not exists cancellation_reason text,
    add column if not exists cancelled_at timestamptz;
