-- system_settings already existed in the database (untracked by any
-- migration) as a generic key-value table: setting_key, setting_value
-- (text), description, updated_by, updated_at. Adds the one row this app
-- needs -- how many days a request can sit unprocessed before
-- send-registrar-alerts flags it, previously hardcoded as OVERDUE_DAYS = 2
-- with no way for the registrar head to change it.
--
-- Guarded with a NOT EXISTS check instead of ON CONFLICT since this
-- table's constraints (whether setting_key is actually unique) predate
-- this migration and aren't guaranteed.
insert into public.system_settings (setting_key, setting_value, description)
select
    'overdue_alert_days',
    '2',
    'How many days a request can sit unprocessed before the daily registrar alert flags it as overdue.'
where not exists (
    select 1 from public.system_settings where setting_key = 'overdue_alert_days'
);
