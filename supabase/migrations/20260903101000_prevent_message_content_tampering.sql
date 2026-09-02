-- "Participants can mark their received messages read" only checks that
-- the actor is the message's receiver -- it doesn't restrict which
-- columns change. Verified exploitable: a receiver could rewrite the
-- entire message content (sender's original words), falsifying the
-- historical record. The app's only legitimate use of this UPDATE path is
-- { is_read: true, read_at: <timestamp> } (grep confirms no other update
-- call exists), so block every other column from changing, for everyone
-- -- there's no separate staff-wide UPDATE policy on messages either.
create or replace function public.prevent_message_content_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.message is distinct from old.message
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

drop trigger if exists trg_prevent_message_content_tampering on public.messages;

create trigger trg_prevent_message_content_tampering
before update on public.messages
for each row
execute function public.prevent_message_content_tampering();
