-- Lobby TV videos fetched automatically from the HCDC Facebook Page.
--
-- The sync-facebook-videos edge function reads the Page's newest videos
-- through Facebook's Graph API (needs FB_PAGE_TOKEN, a Page access token
-- from a Page admin) and keeps them in lobby_videos, newest first. Videos
-- added by hand stay as they are. Runs every hour.
--
-- Needs 20261002000000_lobby_videos. Safe to re-run.

alter table public.lobby_videos
    add column if not exists source text not null default 'manual',
    add column if not exists fb_video_id text,
    add column if not exists published_at timestamptz;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'lobby_videos_source_check') then
        alter table public.lobby_videos
            add constraint lobby_videos_source_check check (source in ('manual', 'facebook'));
    end if;
end;
$$;

-- One row per Facebook video (manual rows have no id; NULLs don't clash).
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'lobby_videos_fb_video_id_key') then
        alter table public.lobby_videos add constraint lobby_videos_fb_video_id_key unique (fb_video_id);
    end if;
end;
$$;

-- Every hour at minute 25.
do $$
begin
    if exists (select 1 from cron.job where jobname = 'sync-facebook-videos') then
        perform cron.unschedule('sync-facebook-videos');
    end if;
end;
$$;

select cron.schedule(
    'sync-facebook-videos',
    '25 * * * *',
    $cmd$
    select net.http_post(
        url := 'https://itirvcydvaujbrwbuctc.supabase.co/functions/v1/sync-facebook-videos',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $cmd$
);

notify pgrst, 'reload schema';
