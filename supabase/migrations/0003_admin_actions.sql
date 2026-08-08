-- Admin audit trail: every admin-users Edge Function action is recorded here
-- via the service role. Read access is restricted to admins (JWT role check).
-- Companion to supabase/functions/admin-users/index.ts.

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  admin_email text,
  action text not null,
  target_id text,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

-- No INSERT/UPDATE policies: writes come only from the service role inside the
-- Edge Function. Admins may view the audit trail; everyone else sees nothing.
drop policy if exists "admin_actions_admin_select" on public.admin_actions;
create policy "admin_actions_admin_select"
on public.admin_actions
for select to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create index if not exists admin_actions_created_at_idx
  on public.admin_actions(created_at desc);
