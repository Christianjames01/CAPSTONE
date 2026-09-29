-- Requests flagged as Lacking Requirements that the student never acts on.
--
-- When staff flag a request (status lacking_requirements), flagged_at is set.
-- If the student then uploads nothing -- no official receipt at all and no
-- requirement file since the flag:
--   day 3 after the flag: a final warning to the student;
--   day 7: the request is rejected automatically (the student is told why);
--   7 days after that: the rejected request is deleted with its records.
-- Uploading a receipt or a requirement, or staff moving the request on,
-- stops it.
--
-- Runs every hour inside the database (pg_cron). Safe to re-run.
--
-- Not deleted: files in Storage (Supabase blocks deleting them from SQL);
-- they're no longer linked to anything and can be cleared in the dashboard.

alter table public.document_requests
    add column if not exists flagged_at timestamptz,
    add column if not exists auto_reject_warned_at timestamptz,
    add column if not exists auto_rejected_at timestamptz;

-- Stamp the flag time whenever a request becomes Lacking Requirements.
create or replace function public.stamp_request_flagged_at()
returns trigger
language plpgsql
as $$
begin
    if new.status::text = 'lacking_requirements' then
        if tg_op = 'INSERT' or old.status::text is distinct from 'lacking_requirements' then
            new.flagged_at := now();
            new.auto_reject_warned_at := null;
        end if;
    else
        new.flagged_at := null;
        new.auto_reject_warned_at := null;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_stamp_request_flagged_at on public.document_requests;
create trigger trg_stamp_request_flagged_at
before insert or update of status on public.document_requests
for each row execute function public.stamp_request_flagged_at();

-- Requests already flagged before this: the clock starts at their last
-- change, but never less than a fresh 3-day warning + 4 days to act.
update public.document_requests
   set flagged_at = greatest(coalesce(updated_at, requested_at, now()), now() - interval '3 days')
 where status::text = 'lacking_requirements'
   and flagged_at is null;

-- Nothing from the student since the flag: no receipt ever, no requirement
-- file uploaded since the flag.
create or replace function public.request_untouched_since_flag(p_request_id uuid, p_flagged_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select not exists (select 1 from official_receipts o where o.request_id = p_request_id)
       and not exists (
           select 1 from request_requirements q
            where q.request_id = p_request_id
              and q.uploaded_at is not null
              and q.uploaded_at >= p_flagged_at
       );
$$;

-- Delete one request and whatever still points at it (tables without
-- "on delete cascade"): nullable links are cleared, required ones deleted.
create or replace function public.purge_document_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    fk record;
    v_nullable boolean;
begin
    for fk in
        select c.conrelid::regclass as tbl, a.attname as col, c.confdeltype
          from pg_constraint c
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
         where c.contype = 'f'
           and c.confrelid = 'public.document_requests'::regclass
           and array_length(c.conkey, 1) = 1
           and c.confdeltype in ('a', 'r')   -- no action / restrict
    loop
        select not a.attnotnull into v_nullable
          from pg_attribute a
         where a.attrelid = fk.tbl and a.attname = fk.col;

        if v_nullable then
            execute format('update %s set %I = null where %I = $1', fk.tbl, fk.col, fk.col) using p_request_id;
        else
            execute format('delete from %s where %I = $1', fk.tbl, fk.col) using p_request_id;
        end if;
    end loop;

    delete from document_requests where request_id = p_request_id;
end;
$$;

revoke execute on function public.purge_document_request(uuid) from public, anon, authenticated;
revoke execute on function public.request_untouched_since_flag(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.auto_reject_flagged_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;
    v_warned integer := 0;
    v_rejected integer := 0;
    v_deleted integer := 0;
    v_reason constant text :=
        'Automatically rejected: no official receipt or missing requirements were uploaded within 7 days after the Registrar flagged this request.';
begin
    -- Day 3: final warning (once).
    for r in
        select dr.request_id, dr.request_number, dr.flagged_at, s.user_id,
               coalesce(dt.document_name, 'your document') as document_name
          from document_requests dr
          join students s on s.student_id = dr.student_id
          left join document_types dt on dt.document_type_id = dr.document_type_id
         where dr.status::text = 'lacking_requirements'
           and dr.flagged_at <= now() - interval '3 days'
           and dr.flagged_at > now() - interval '7 days'
           and dr.auto_reject_warned_at is null
    loop
        continue when not request_untouched_since_flag(r.request_id, r.flagged_at);
        begin
            insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                r.user_id,
                'Final reminder: your request will be rejected',
                format('Request %s (%s) is still missing requirements. Upload them by %s, or it will be rejected automatically.',
                       r.request_number, r.document_name,
                       to_char((r.flagged_at + interval '7 days') at time zone 'Asia/Manila', 'FMMonth FMDD, YYYY FMHH12:MI AM')),
                'request_update', r.request_id, false
            );
            update document_requests set auto_reject_warned_at = now() where request_id = r.request_id;
            v_warned := v_warned + 1;
        exception when others then
            raise warning 'auto-reject warning failed for %: %', r.request_id, sqlerrm;
        end;
    end loop;

    -- Day 7: reject.
    for r in
        select dr.request_id, dr.request_number, dr.flagged_at, s.user_id,
               coalesce(dt.document_name, 'your document') as document_name
          from document_requests dr
          join students s on s.student_id = dr.student_id
          left join document_types dt on dt.document_type_id = dr.document_type_id
         where dr.status::text = 'lacking_requirements'
           and dr.flagged_at <= now() - interval '7 days'
    loop
        continue when not request_untouched_since_flag(r.request_id, r.flagged_at);
        begin
            update document_requests
               set status = 'rejected',
                   rejection_reason = v_reason,
                   auto_rejected_at = now()
             where request_id = r.request_id
               and status::text = 'lacking_requirements';

            insert into notifications (user_id, title, message, notification_type, related_request_id, is_read)
            values (
                r.user_id,
                'Request rejected',
                format('Request %s (%s) was rejected because the missing requirements were not uploaded within 7 days. It will be removed in 7 days. You can submit a new request anytime.',
                       r.request_number, r.document_name),
                'request_update', r.request_id, false
            );

            begin
                insert into activity_logs (user_id, action, table_name, record_id, description)
                values (null, 'auto_reject_request', 'document_requests', r.request_id,
                        format('Request %s was rejected automatically: nothing uploaded within 7 days after it was flagged.', r.request_number));
            exception when others then
                null;
            end;

            v_rejected := v_rejected + 1;
        exception when others then
            raise warning 'auto-reject failed for %: %', r.request_id, sqlerrm;
        end;
    end loop;

    -- 7 days after an automatic rejection: delete it.
    for r in
        select request_id, request_number
          from document_requests
         where status::text = 'rejected'
           and auto_rejected_at is not null
           and auto_rejected_at <= now() - interval '7 days'
    loop
        begin
            perform purge_document_request(r.request_id);
            begin
                insert into activity_logs (user_id, action, table_name, record_id, description)
                values (null, 'auto_delete_request', 'document_requests', r.request_id,
                        format('Deleted request %s: automatically rejected 7 days ago.', r.request_number));
            exception when others then
                null;
            end;
            v_deleted := v_deleted + 1;
        exception when others then
            raise warning 'auto-delete failed for %: %', r.request_id, sqlerrm;
        end;
    end loop;

    return jsonb_build_object('warned', v_warned, 'rejected', v_rejected, 'deleted', v_deleted);
end;
$$;

revoke execute on function public.auto_reject_flagged_requests() from public, anon, authenticated;

-- Every hour, at minute 15.
do $$
begin
    if exists (select 1 from cron.job where jobname = 'auto-reject-flagged-requests') then
        perform cron.unschedule('auto-reject-flagged-requests');
    end if;
end;
$$;

select cron.schedule(
    'auto-reject-flagged-requests',
    '15 * * * *',
    $$ select public.auto_reject_flagged_requests(); $$
);

notify pgrst, 'reload schema';
