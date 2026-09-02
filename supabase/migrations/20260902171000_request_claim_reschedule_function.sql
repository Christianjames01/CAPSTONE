-- Students have no UPDATE policy on claim_schedules at all (only staff do),
-- and a broad one would let them rewrite status/dates on their own claim --
-- e.g. marking it "claimed" without actually collecting the document. This
-- function only ever touches reschedule_requested_at/reschedule_reason, and
-- only for the caller's own schedule, so it's safe to expose directly.
create or replace function public.request_claim_reschedule(p_claim_schedule_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owns boolean;
begin
    select exists (
        select 1
        from claim_schedules cs
        join students s on s.student_id = cs.student_id
        where cs.claim_schedule_id = p_claim_schedule_id
          and s.user_id = auth.uid()
          and cs.status in ('scheduled', 'missed')
          and cs.reschedule_requested_at is null
    ) into v_owns;

    if not v_owns then
        raise exception 'Reschedule request is not allowed for this claim schedule.';
    end if;

    update claim_schedules
    set reschedule_requested_at = now(),
        reschedule_reason = p_reason
    where claim_schedule_id = p_claim_schedule_id;
end;
$$;

grant execute on function public.request_claim_reschedule(uuid, text) to authenticated;
