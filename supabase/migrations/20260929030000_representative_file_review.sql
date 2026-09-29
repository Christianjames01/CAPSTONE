-- Authorized representatives: review the signed letter and the valid ID
-- separately. Staff approve or reject each file (with a reason); the student
-- sees which one was rejected and why, and replaces just that picture -- the
-- other keeps its approval.
--
-- The overall status stays (the release window and notifications use it)
-- and is now worked out from the two files:
--   both approved -> approved;  either rejected -> rejected;  else pending.
-- review_note holds the rejection reason(s) for the notification.
--
-- Safe to re-run.

alter table public.claim_representatives
    add column if not exists letter_status text not null default 'pending',
    add column if not exists letter_note text,
    add column if not exists id_status text not null default 'pending',
    add column if not exists id_note text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'claim_representatives_letter_status_check') then
        alter table public.claim_representatives
            add constraint claim_representatives_letter_status_check check (letter_status in ('pending', 'approved', 'rejected'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'claim_representatives_id_status_check') then
        alter table public.claim_representatives
            add constraint claim_representatives_id_status_check check (id_status in ('pending', 'approved', 'rejected'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'claim_representatives_file_notes_length') then
        alter table public.claim_representatives
            add constraint claim_representatives_file_notes_length check (
                (letter_note is null or length(letter_note) <= 500) and (id_note is null or length(id_note) <= 500)
            );
    end if;
end;
$$;

-- Existing reviews: both files take the overall result.
update public.claim_representatives
   set letter_status = status,
       id_status = status,
       letter_note = case when status = 'rejected' then review_note end,
       id_note = case when status = 'rejected' then review_note end
 where letter_status = 'pending' and id_status = 'pending' and status <> 'pending';

create or replace function public.guard_claim_representative()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_old_status text := case when tg_op = 'UPDATE' then old.status end;
begin
    new.updated_at := now();

    if public.is_request_staff() then
        -- An older page setting only the overall status: apply it to both files.
        if tg_op = 'UPDATE'
           and new.status is distinct from old.status
           and new.letter_status is not distinct from old.letter_status
           and new.id_status is not distinct from old.id_status then
            new.letter_status := new.status;
            new.id_status := new.status;
            new.letter_note := case when new.status = 'rejected' then new.review_note end;
            new.id_note := case when new.status = 'rejected' then new.review_note end;
        end if;
    else
        -- Student: can't review. A replaced file (or changed person) goes back
        -- to review; an untouched file keeps its result.
        if tg_op = 'INSERT' then
            new.letter_status := 'pending';
            new.id_status := 'pending';
            new.letter_note := null;
            new.id_note := null;
        else
            new.request_id := old.request_id;
            new.student_id := old.student_id;
            new.created_at := old.created_at;

            if new.full_name is distinct from old.full_name or new.relationship is distinct from old.relationship then
                new.letter_status := 'pending';
                new.id_status := 'pending';
                new.letter_note := null;
                new.id_note := null;
            else
                if new.authorization_letter_path is distinct from old.authorization_letter_path then
                    new.letter_status := 'pending';
                    new.letter_note := null;
                else
                    new.letter_status := old.letter_status;
                    new.letter_note := old.letter_note;
                end if;

                if new.valid_id_path is distinct from old.valid_id_path then
                    new.id_status := 'pending';
                    new.id_note := null;
                else
                    new.id_status := old.id_status;
                    new.id_note := old.id_note;
                end if;
            end if;
        end if;
    end if;

    -- Overall result from the two files.
    new.status := case
        when new.letter_status = 'approved' and new.id_status = 'approved' then 'approved'
        when new.letter_status = 'rejected' or new.id_status = 'rejected' then 'rejected'
        else 'pending'
    end;

    new.review_note := nullif(concat_ws('; ',
        case when new.letter_status = 'rejected' then 'Authorization letter: ' || coalesce(nullif(btrim(new.letter_note), ''), 'not accepted') end,
        case when new.id_status = 'rejected' then 'Valid ID: ' || coalesce(nullif(btrim(new.id_note), ''), 'not accepted') end
    ), '');

    if public.is_request_staff() and new.status is distinct from v_old_status then
        new.reviewed_by := auth.uid();
        new.reviewed_at := now();
    elsif not public.is_request_staff() and new.status = 'pending' then
        new.reviewed_by := null;
        new.reviewed_at := null;
    end if;

    return new;
end;
$$;

notify pgrst, 'reload schema';
