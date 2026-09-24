-- The admin Messages page (oversight) shows "<name> deleted this message"
-- when a participant deletes a message for themselves. message_hidden rows
-- are otherwise private to the person who hid them, so let the registrar
-- head / admin read all of them. Students and employees still only see
-- their own.

drop policy if exists "Registrar head and admin can view all hidden messages" on public.message_hidden;

create policy "Registrar head and admin can view all hidden messages"
on public.message_hidden
for select
to authenticated
using (is_registrar_head());

notify pgrst, 'reload schema';
