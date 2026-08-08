-- Normalize the existing admin account's role to the lowercase value the app
-- expects ("Admin" -> "admin"). Idempotent. Also drops any leftover scaffold.
update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
where email = lower('iddrisumohamme1@gmail.com')
  and (raw_user_meta_data ->> 'role') is distinct from 'admin';

drop table if exists public._tmp_user_inventory;
