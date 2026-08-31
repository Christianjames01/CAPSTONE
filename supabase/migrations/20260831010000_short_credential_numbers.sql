-- credential_number was 'CERT-' + Date.now() + '-' + random (e.g.
-- CERT-1787829238026-548) -- same unwieldy problem as request_number,
-- fixed the same way: a database trigger assigns a short sequential
-- number atomically on insert (CERT-000001, ...), regardless of what
-- the client sends. Existing credentials keep their old numbers.
create sequence if not exists credential_number_seq start 1;

create or replace function set_credential_number()
returns trigger
language plpgsql
as $$
begin
    new.credential_number := 'CERT-' || lpad(nextval('credential_number_seq')::text, 6, '0');
    return new;
end;
$$;

create trigger trg_set_credential_number
before insert on credentials
for each row
execute function set_credential_number();
