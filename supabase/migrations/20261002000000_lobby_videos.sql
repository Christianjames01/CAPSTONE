-- Lobby TV videos: Facebook videos (e.g. from the Holy Cross of Davao College
-- page) the queue display plays between the queue, every 2 minutes.
--
-- The Registrar Head/admin manages the list on the Queue page; staff (whose
-- login runs the lobby TV) can read it. Each video plays for play_seconds
-- (Facebook's embedded player doesn't report when a video ends).
--
-- Safe to re-run.

create table if not exists public.lobby_videos (
    video_id uuid primary key default gen_random_uuid(),
    url text not null check (url ~* '^https://([a-z0-9-]+\.)?(facebook\.com|fb\.watch)/'),
    title text check (title is null or length(title) <= 120),
    play_seconds integer not null default 60 check (play_seconds between 10 and 900),
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now()
);

create index if not exists lobby_videos_order_idx on public.lobby_videos (is_active, sort_order, created_at);

alter table public.lobby_videos enable row level security;

drop policy if exists "Staff can view lobby videos" on public.lobby_videos;
create policy "Staff can view lobby videos"
on public.lobby_videos for select to authenticated
using (public.is_request_staff());

drop policy if exists "Head can manage lobby videos" on public.lobby_videos;
create policy "Head can manage lobby videos"
on public.lobby_videos for all to authenticated
using (public.is_registrar_head_or_admin())
with check (public.is_registrar_head_or_admin());

grant select, insert, update, delete on public.lobby_videos to authenticated;
revoke all on public.lobby_videos from anon;

-- The TV picks up changes live.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_videos'
    ) then
        alter publication supabase_realtime add table public.lobby_videos;
    end if;
end;
$$;

notify pgrst, 'reload schema';
