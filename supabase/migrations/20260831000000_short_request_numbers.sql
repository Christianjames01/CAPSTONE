-- request_number was 'REQ-' + Date.now() (17 characters, e.g.
-- REQ-1787846214149) -- unwieldy to read aloud or type into a search
-- box. Switches to a short, DB-generated sequential number instead
-- (REQ-000001, REQ-000002, ...), assigned atomically on insert
-- regardless of what the client sends, so there's no collision risk.
-- Existing rows keep their old long numbers; only new ones get the
-- short format, and the two are visually distinguishable anyway.
create sequence if not exists request_number_seq start 1;

create or replace function set_request_number()
returns trigger
language plpgsql
as $$
begin
    new.request_number := 'REQ-' || lpad(nextval('request_number_seq')::text, 6, '0');
    return new;
end;
$$;

create trigger trg_set_request_number
before insert on document_requests
for each row
execute function set_request_number();
