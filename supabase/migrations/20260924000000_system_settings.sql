-- First generic, site-wide settings table -- starts with just the
-- registrar-alert overdue threshold (how many days a request can sit
-- unprocessed before send-registrar-alerts flags it), previously hardcoded
-- as OVERDUE_DAYS = 2 in that Edge Function with no way for the registrar
-- head to change it. Designed as a singleton row so future settings can be
-- added as new columns without a schema rethink.
create table if not exists public.system_settings (
    id smallint primary key default 1,
    overdue_alert_days integer not null default 2,
    updated_at timestamptz,
    updated_by uuid references auth.users(id),
    constraint system_settings_singleton check (id = 1),
    constraint system_settings_overdue_alert_days_positive check (overdue_alert_days > 0)
);

insert into public.system_settings (id, overdue_alert_days)
values (1, 2)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

create policy "Admin and registrar head can view system settings"
on public.system_settings for select
to authenticated
using (is_registrar_head());

create policy "Registrar head can update system settings"
on public.system_settings for update
to authenticated
using (is_registrar_head())
with check (is_registrar_head());
