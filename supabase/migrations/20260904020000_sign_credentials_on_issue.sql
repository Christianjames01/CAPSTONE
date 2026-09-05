-- Credentials were validated in verify-credential purely by looking up the
-- row in public_credential_verification -- if a credential's identity fields
-- (which student, which document, which request) were ever altered directly
-- in the database (bad migration, compromised service-role key, a manual
-- "fix" by someone with DB access), the public verify page would show it as
-- valid with no way to tell. Adds an HMAC-SHA256 signature over each
-- credential's identity fields, computed at insert time from a secret that
-- never leaves Vault, so tampering with a row after issuance can be
-- detected instead of the row being trusted blindly.
--
-- On a fresh environment this creates a random signing secret automatically.
-- Existing credentials are backfilled with a signature computed from their
-- current field values at migration time.

do $$
begin
    if not exists (select 1 from vault.secrets where name = 'credential_signing_secret') then
        perform vault.create_secret(
            encode(gen_random_bytes(32), 'hex'),
            'credential_signing_secret',
            'HMAC key used to sign issued credentials so tampering with a row after issuance can be detected. Only ever read inside SECURITY DEFINER functions -- never exposed to Edge Functions or clients.'
        );
    end if;
end;
$$;

alter table credentials add column if not exists signature text;

create or replace function public.sign_credential()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $function$
declare
    v_secret text;
begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'credential_signing_secret';

    new.signature := encode(
        hmac(
            concat_ws('|',
                new.credential_number,
                new.student_id::text,
                new.document_type_id::text,
                new.request_id::text,
                new.generated_at::text
            ),
            v_secret,
            'sha256'
        ),
        'hex'
    );

    return new;
end;
$function$;

-- Runs after trg_set_credential_number (alphabetically ordered: 'set' < 'sign'),
-- so new.credential_number is already assigned by the time this fires.
create trigger trg_sign_credential
before insert on credentials
for each row
execute function public.sign_credential();

revoke execute on function public.sign_credential() from public, anon, authenticated;

-- Verifies a credential's signature without ever handing the signing secret
-- to the caller -- Edge Functions call this via RPC with the service role
-- and get back a plain boolean.
create or replace function public.verify_credential_signature(p_credential_number text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $function$
declare
    v_secret text;
    v_row credentials%rowtype;
    v_expected text;
begin
    select * into v_row from credentials where credential_number = p_credential_number;

    if not found or v_row.signature is null then
        return false;
    end if;

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'credential_signing_secret';

    v_expected := encode(
        hmac(
            concat_ws('|',
                v_row.credential_number,
                v_row.student_id::text,
                v_row.document_type_id::text,
                v_row.request_id::text,
                v_row.generated_at::text
            ),
            v_secret,
            'sha256'
        ),
        'hex'
    );

    return v_expected = v_row.signature;
end;
$function$;

revoke execute on function public.verify_credential_signature(text) from public, anon, authenticated;
grant execute on function public.verify_credential_signature(text) to service_role;

-- Backfill: sign every credential issued before this migration existed.
do $$
declare
    v_secret text;
begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'credential_signing_secret';

    update credentials
    set signature = encode(
        hmac(
            concat_ws('|',
                credential_number,
                student_id::text,
                document_type_id::text,
                request_id::text,
                generated_at::text
            ),
            v_secret,
            'sha256'
        ),
        'hex'
    )
    where signature is null;
end;
$$;
