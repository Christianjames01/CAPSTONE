-- "Delete" on the admin Messages page now means "delete for me": it hides
-- messages from the person who deleted them, and everyone else in the
-- conversation keeps seeing them. Each hide is one row here; the page
-- filters out the current user's hidden message_ids.
--
-- messages.message_id's type isn't recorded in migrations (the table was
-- created from the dashboard), so read it from the catalog to keep the
-- foreign key type-compatible.

do $$
declare
    v_type text;
begin
    select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_attribute a
    where a.attrelid = 'public.messages'::regclass
      and a.attname = 'message_id'
      and not a.attisdropped;

    execute format($sql$
        create table if not exists public.message_hidden (
            user_id uuid not null references auth.users(id) on delete cascade,
            message_id %s not null references public.messages(message_id) on delete cascade,
            hidden_at timestamptz not null default now(),
            primary key (user_id, message_id)
        )
    $sql$, v_type);
end;
$$;

alter table public.message_hidden enable row level security;

drop policy if exists "Users can view their own hidden messages" on public.message_hidden;
create policy "Users can view their own hidden messages"
on public.message_hidden
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can hide messages for themselves" on public.message_hidden;
create policy "Users can hide messages for themselves"
on public.message_hidden
for insert
to authenticated
with check (user_id = auth.uid());

-- The previous migration let the head delete messages for everyone; the page
-- no longer does that, so take the permission back out.
drop policy if exists "Registrar head and admin can delete messages" on public.messages;
