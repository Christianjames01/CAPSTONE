-- Lets the sender edit their own messages from any Messages page (student,
-- employee, registrar head), and marks them as edited.
--
-- trg_prevent_message_content_tampering (20260903101000) blocks every
-- content change so a *receiver* can't rewrite what was said to them. That
-- protection stays: the only way to change message text is
-- edit_my_message(), which checks the caller is the sender and sets a
-- transaction-local flag the trigger honors for that one update.

alter table public.messages add column if not exists edited_at timestamptz;

create or replace function public.prevent_message_content_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- edit_my_message(): the sender may change the text (and edited_at),
    -- nothing else.
    if coalesce(current_setting('app.message_edit', true), '') = 'on'
        and old.sender_user_id = auth.uid()
    then
        if new.sender_user_id is distinct from old.sender_user_id
            or new.receiver_user_id is distinct from old.receiver_user_id
            or new.request_id is distinct from old.request_id
            or new.attachment_file_name is distinct from old.attachment_file_name
            or new.attachment_file_path is distinct from old.attachment_file_path
        then
            raise exception 'Only the message text can be edited.';
        end if;
        return new;
    end if;

    if new.message is distinct from old.message
        or new.edited_at is distinct from old.edited_at
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

-- One message on screen can be several rows (one per recipient, plus a
-- hidden [[ref=<student>]] routing copy for the employee), all inserted
-- together by the same sender, so they share sender_user_id + created_at.
-- Edit them all, keeping any routing tag in front of the new text.
-- message_id is compared as text because its type was set in the dashboard.
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
    v_text text := btrim(coalesce(p_new_text, ''));
    v_count integer;
begin
    if v_uid is null then
        raise exception 'Not signed in.';
    end if;

    if v_text = '' then
        raise exception 'A message cannot be empty.';
    end if;

    select sender_user_id, created_at into v_sender, v_created_at
    from messages
    where message_id::text = p_message_id;

    if not found then
        raise exception 'Message not found.';
    end if;

    if v_sender <> v_uid then
        raise exception 'You can only edit your own messages.';
    end if;

    perform set_config('app.message_edit', 'on', true);

    update messages
    set message = coalesce(substring(message from '^\[\[ref=[0-9a-f-]+\]\]'), '') || v_text,
        edited_at = now()
    where sender_user_id = v_uid
      and created_at = v_created_at;

    get diagnostics v_count = row_count;

    perform set_config('app.message_edit', 'off', true);

    return v_count;
end;
$$;

revoke execute on function public.edit_my_message(text, text) from public, anon;
grant execute on function public.edit_my_message(text, text) to authenticated;
