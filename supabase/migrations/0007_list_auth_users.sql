-- TEMP: enumerate auth users (bypasses RLS via SECURITY DEFINER).
-- Called via PostgREST rpc, dropped by the follow-up migration.
create or replace function public.list_auth_users()
returns table (
  user_id    text,
  email      text,
  role       text,
  provider   text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id::text,
    u.email,
    u.raw_user_meta_data ->> 'role' as role,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  order by u.created_at;
$$;

grant execute on function public.list_auth_users() to anon, authenticated;
