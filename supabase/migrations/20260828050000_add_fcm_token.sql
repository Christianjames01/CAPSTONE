-- Stores each user's current FCM registration token for web push. A user
-- can only have one active token per browser/device at a time here (kept
-- simple: latest token wins), which is enough for this app's single-session
-- usage pattern. No new RLS policy needed: "Students can update own profile"
-- already permits any authenticated user to update their own profile row
-- (qual: user_id = auth.uid()), which covers this column too.
alter table public.profiles
add column fcm_token text;
