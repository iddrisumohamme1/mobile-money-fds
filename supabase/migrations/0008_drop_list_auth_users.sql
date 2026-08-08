-- Cleanup: remove the temporary auth-users inventory function.
drop function if exists public.list_auth_users();
