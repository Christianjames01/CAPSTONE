import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)

// Speed: pages ask "who is logged in?" through auth.getUser() in many
// places (the layout, the page, the badge counters...). By default that is
// a network round trip to Supabase Auth every time (~0.3 s from Davao).
// Answer it from the locally stored session instead -- the same signed-in
// user, with no trip. Data access is still checked by the database (RLS)
// on every request, and an expired session is refreshed by getSession().
// Falls back to the real call when there's no stored session or a token is
// passed explicitly.
const fetchUser = supabase.auth.getUser.bind(supabase.auth)

supabase.auth.getUser = async (jwt) => {
  if (jwt) return fetchUser(jwt)

  const { data, error } = await supabase.auth.getSession()
  const user = data?.session?.user

  if (user) return { data: { user }, error: null }
  if (error) return { data: { user: null }, error }
  return fetchUser()
}
