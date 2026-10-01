-- READ-ONLY security audit for the live database. Changes nothing.
-- Run in the Supabase SQL Editor; every row is something to review.
--
--   area                 what it means
--   no_rls               table in public without Row Level Security
--   anon_policy          a policy that applies to signed-out visitors
--   open_write_policy    INSERT/UPDATE/DELETE/ALL policy with USING/CHECK (true)
--   anon_definer_fn      SECURITY DEFINER function signed-out visitors can call
--   public_bucket        storage bucket anyone can read without signing in
--   anon_view            view in public that signed-out visitors can read
--   new_user_trigger     the function that builds a profile at sign-up (check
--                        it never trusts a role other than student/employee)

select 'no_rls' as area, c.relname as item, 'RLS is off' as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
select 'anon_policy', tablename || ' · ' || policyname,
       cmd || ' using ' || coalesce(qual, '-') || ' check ' || coalesce(with_check, '-')
  from pg_policies
 where schemaname = 'public' and ('anon' = any (roles) or 'public' = any (roles))

union all
select 'open_write_policy', tablename || ' · ' || policyname,
       cmd || ' to ' || array_to_string(roles, ',')
  from pg_policies
 where schemaname = 'public'
   and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')

union all
select 'anon_definer_fn', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'returns ' || pg_get_function_result(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosecdef
   and pg_get_function_result(p.oid) <> 'trigger'
   and has_function_privilege('anon', p.oid, 'execute')

union all
select 'public_bucket', id, 'public = true'
  from storage.buckets
 where public

union all
select 'anon_view', c.relname, 'selectable by anon'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('v', 'm')
   and has_table_privilege('anon', c.oid, 'select')

union all
select 'new_user_trigger', p.proname, pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'handle_new_user'

order by 1, 2;
