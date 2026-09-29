-- Re-check the signed-in user's own password inside the database, for the
-- password confirmation on manual status changes (lib/confirmPassword.js).
-- Doing it through a normal sign-in brought up the Cloudflare security
-- check every time; this compares against the stored password hash instead.
--
-- Only ever checks the caller's OWN password (auth.uid()). Wrong attempts
-- are recorded, and after 5 wrong ones in 15 minutes it refuses until the
-- window passes, so it can't be used to guess a password. Safe to re-run.

create table if not exists public.password_check_attempts (
    attempt_id bigint generated always as identity primary key,
    user_id uuid not null,
    succeeded boolean not null,
    attempted_at timestamptz not null default now()
);

create index if not exists password_check_attempts_user_time_idx
    on public.password_check_attempts (user_id, attempted_at desc);

-- Only this function touches the table.
alter table public.password_check_attempts enable row level security;
revoke all on public.password_check_attempts from public, anon, authenticated;

create or replace function public.verify_my_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_uid uuid := auth.uid();
    v_recent_failures integer;
    v_ok boolean;
begin
    if v_uid is null then
        raise exception 'You are not logged in.' using errcode = 'P0001';
    end if;

    select count(*) into v_recent_failures
      from password_check_attempts
     where user_id = v_uid
       and succeeded = false
       and attempted_at > now() - interval '15 minutes';

    if v_recent_failures >= 5 then
        raise exception 'Too many wrong passwords. Please wait 15 minutes and try again.' using errcode = 'P0001';
    end if;

    select coalesce(u.encrypted_password <> '' and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password), false)
      into v_ok
      from auth.users u
     where u.id = v_uid;

    v_ok := coalesce(v_ok, false);

    insert into password_check_attempts (user_id, succeeded) values (v_uid, v_ok);

    -- Keep the table small.
    delete from password_check_attempts where attempted_at < now() - interval '1 day';

    return v_ok;
end;
$$;

revoke execute on function public.verify_my_password(text) from public, anon;
grant execute on function public.verify_my_password(text) to authenticated;
