-- The admin Messages page can now delete a single message or a whole
-- conversation. `messages` only had policies for participants to read/send
-- their own rows, so a client-side delete would silently affect 0 rows.
--
-- Scoped to the registrar head / admin (same is_registrar_head() check the
-- other oversight policies use) -- students and employees still can't
-- delete anything, including their own messages.

drop policy if exists "Registrar head and admin can delete messages" on public.messages;

create policy "Registrar head and admin can delete messages"
on public.messages
for delete
to authenticated
using (is_registrar_head());
