-- Let the sign-up forms warn when a phone number is already registered to
-- another account, like is_student_number_taken() (20260925050000).
--
-- Compared on digits only, so "0917-123-4567" matches "09171234567". The
-- caller's own profile and rejected student registrations are ignored.
-- Returns only true/false, so it's safe for signed-out users. There's no
-- unique index: existing accounts may legitimately share a number (e.g. a
-- parent's phone), so this is a form-level check only.

create or replace function public.is_phone_number_taken(p_phone_number text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case
        when length(regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g')) < 7 then false
        else exists (
            select 1
            from profiles p
            left join students s on s.user_id = p.user_id
            where regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g')
                    = regexp_replace(p_phone_number, '\D', '', 'g')
              and p.user_id is distinct from auth.uid()
              and s.verification_status is distinct from 'rejected'
        )
    end;
$$;

revoke execute on function public.is_phone_number_taken(text) from public;
grant execute on function public.is_phone_number_taken(text) to anon, authenticated;

notify pgrst, 'reload schema';
