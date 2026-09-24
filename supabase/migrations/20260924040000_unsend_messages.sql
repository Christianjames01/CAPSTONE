-- "Delete" on a message now means unsend for everyone: every participant
-- sees a "<name> deleted a message" placeholder instead of the text.
--
-- The text is removed from public.messages (so students/employees can't
-- read it back through the API) and archived in message_deleted_content,
-- which only the registrar head / admin can read, for oversight.
--
-- Only the sender can delete, via delete_my_message(); the tampering
-- trigger still blocks every other content change.

alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- message_id's type was set in the dashboard, so read it for the FK.
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
        create table if not exists public.message_deleted_content (
            message_id %s primary key references public.messages(message_id) on delete cascade,
            original_message text not null,
            deleted_by uuid references auth.users(id) on delete set null,
            deleted_at timestamptz not null default now()
        )
    $sql$, v_type);
end;
$$;

alter table public.message_deleted_content enable row level security;

-- Read-only for the head; rows are only ever written by delete_my_message().
drop policy if exists "Registrar head and admin can view deleted message content" on public.message_deleted_content;
create policy "Registrar head and admin can view deleted message content"
on public.message_deleted_content
for select
to authenticated
using (is_registrar_head());

create or replace function public.prevent_message_content_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- edit_my_message() / delete_my_message(): the sender may change the
    -- text and its edited/deleted markers, nothing else.
    if coalesce(current_setting('app.message_edit', true), '') = 'on'
        and old.sender_user_id = auth.uid()
    then
        if new.sender_user_id is distinct from old.sender_user_id
            or new.receiver_user_id is distinct from old.receiver_user_id
            or new.request_id is distinct from old.request_id
            or new.attachment_file_name is distinct from old.attachment_file_name
            or new.attachment_file_path is distinct from old.attachment_file_path
        then
            raise exception 'Only the message text can be changed.';
        end if;
        return new;
    end if;

    if new.message is distinct from old.message
        or new.edited_at is distinct from old.edited_at
        or new.deleted_at is distinct from old.deleted_at
        or new.deleted_by is distinct from old.deleted_by
        or new.sender_user_id is distinct from old.sender_user_id
        or new.receiver_user_id is distinct from old.receiver_user_id
        or new.request_id is distinct from old.request_id
        or new.attachment_file_name is distinct from old.attachment_file_name
        or new.attachment_file_path is distinct from old.attachment_file_path
    then
        raise exception 'Messages can only be marked as read, not edited.';
    end if;
    return new;
end;
$$;

-- A deleted message can't be edited back into existence.
create or replace function public.edit_my_message(p_message_id text, p_new_text text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_sender uuid;
    v_created_at timestamptz;
    v_deleted_at timestamptz;
    v_text text := btrim(coalesce(p_new_text, ''));
    v_count integer;
begin
    if v_uid is null then raise exception 'Not signed in.'; end if;
    if v_text = '' then raise exception 'A message cannot be empty.'; end if;

    select sender_user_id, created_at, deleted_at into v_sender, v_created_at, v_deleted_at
    from messages where message_id::text = p_message_id;

    if not found then raise exception 'Message not found.'; end if;
    if v_sender <> v_uid then raise exception 'You can only edit your own messages.'; end if;
    if v_deleted_at is not null then raise exception 'This message was deleted.'; end if;

    perform set_config('app.message_edit', 'on', true);

    update messages
    set message = coalesce(substring(message from '^\[\[ref=[0-9a-f-]+\]\]'), '') || v_text,
        edited_at = now()
    where sender_user_id = v_uid and created_at = v_created_at;

    get diagnostics v_count = row_count;
    perform set_config('app.message_edit', 'off', true);
    return v_count;
end;
$$;

-- Unsend: archives the text of every copy (same sender + created_at, see
-- edit_my_message) and blanks it, keeping any [[ref=]] routing tag so the
-- employee page still files the copy under the right student.
create or replace function public.delete_my_message(p_message_id text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_sender uuid;
    v_created_at timestamptz;
    v_count integer;
begin
    if v_uid is null then raise exception 'Not signed in.'; end if;

    select sender_user_id, created_at into v_sender, v_created_at
    from messages where message_id::text = p_message_id;

    if not found then raise exception 'Message not found.'; end if;
    if v_sender <> v_uid then raise exception 'You can only delete your own messages.'; end if;

    insert into message_deleted_content (message_id, original_message, deleted_by)
    select message_id, message, v_uid
    from messages
    where sender_user_id = v_uid and created_at = v_created_at and deleted_at is null
    on conflict (message_id) do nothing;

    perform set_config('app.message_edit', 'on', true);

    update messages
    set message = coalesce(substring(message from '^\[\[ref=[0-9a-f-]+\]\]'), '') || '[message deleted]',
        deleted_at = now(),
        deleted_by = v_uid
    where sender_user_id = v_uid and created_at = v_created_at and deleted_at is null;

    get diagnostics v_count = row_count;
    perform set_config('app.message_edit', 'off', true);
    return v_count;
end;
$$;

revoke execute on function public.delete_my_message(text) from public, anon;
grant execute on function public.delete_my_message(text) to authenticated;

notify pgrst, 'reload schema';
