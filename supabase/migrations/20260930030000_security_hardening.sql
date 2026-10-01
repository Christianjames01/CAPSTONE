-- Security hardening from the October 2026 review.
--
-- 1. Queue numbers: next_queue_number / reserve_queue_numbers are
--    SECURITY DEFINER and were executable by anyone (PUBLIC), including
--    signed-out visitors -- who could skip the counter ahead or reserve huge
--    blocks. Now: registrar staff only, batch size capped.
--
-- 2. Sign-up can never create a Registrar Head or admin profile. The profile
--    is built from the sign-up metadata, which the person signing up
--    controls; only someone working directly in the database (postgres)
--    may create those roles.
--
-- Safe to re-run.

create or replace function public.next_queue_number(p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_number integer;
begin
    if not public.is_request_staff() then
        raise exception 'Only registrar staff can issue queue numbers.' using errcode = '42501';
    end if;

    insert into queue_counters (queue_date, last_number)
    values (p_date, 1)
    on conflict (queue_date)
        do update set last_number = queue_counters.last_number + 1
    returning last_number into v_number;

    return v_number;
end;
$$;

create or replace function public.reserve_queue_numbers(p_date date, p_count integer)
returns integer[]
language plpgsql
security definer
set search_path = public
as $$
declare
    v_end integer;
    v_start integer;
    v_numbers integer[];
begin
    if not public.is_request_staff() then
        raise exception 'Only registrar staff can issue queue numbers.' using errcode = '42501';
    end if;
    if p_count is null or p_count < 1 or p_count > 200 then
        raise exception 'p_count must be between 1 and 200';
    end if;

    insert into queue_counters (queue_date, last_number)
    values (p_date, p_count)
    on conflict (queue_date)
        do update set last_number = queue_counters.last_number + p_count
    returning last_number into v_end;

    v_start := v_end - p_count + 1;

    select array_agg(n order by n) into v_numbers
    from generate_series(v_start, v_end) as n;

    return v_numbers;
end;
$$;

revoke execute on function public.next_queue_number(date) from public, anon;
revoke execute on function public.reserve_queue_numbers(date, integer) from public, anon;
grant execute on function public.next_queue_number(date) to authenticated;
grant execute on function public.reserve_queue_numbers(date, integer) to authenticated;

create or replace function public.block_privileged_profile_insert()
returns trigger
language plpgsql
as $$
begin
    -- session_user is the login role (sign-ups run as supabase_auth_admin,
    -- API calls as authenticator); it doesn't change inside SECURITY
    -- DEFINER functions such as the new-user trigger.
    if new.role::text in ('registrar_head', 'admin') and session_user <> 'postgres' then
        raise exception 'This account type cannot be created by signing up.' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_block_privileged_profile_insert on public.profiles;
create trigger trg_block_privileged_profile_insert
before insert on public.profiles
for each row execute function public.block_privileged_profile_insert();

revoke execute on function public.block_privileged_profile_insert() from public, anon, authenticated;

notify pgrst, 'reload schema';
