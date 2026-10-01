-- Remove the lobby TV video feature (Facebook videos on the queue display).
-- The queue display shows only the walkthrough demo again.
--
-- Safe to re-run, and safe where the feature was never installed.

do $$
begin
    if exists (select 1 from cron.job where jobname = 'sync-facebook-videos') then
        perform cron.unschedule('sync-facebook-videos');
    end if;
end;
$$;

drop table if exists public.lobby_videos;

notify pgrst, 'reload schema';
