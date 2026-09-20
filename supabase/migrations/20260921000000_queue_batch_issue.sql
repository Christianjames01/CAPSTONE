-- Lets the head issue a whole block of ticket numbers in one action (e.g.
-- pre-printing numbers 1-50 at the start of the day) instead of clicking
-- "Issue Number" one at a time. Reserves a contiguous range atomically in
-- a single upsert (same collision-safe approach as next_queue_number), so
-- concurrent issuance still never produces a duplicate or gap.
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
    if p_count is null or p_count < 1 then
        raise exception 'p_count must be at least 1';
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
