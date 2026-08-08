-- ============================================================
-- Mobile Money FDS | Supabase Schema
-- Paste this file into: Supabase Dashboard -> SQL Editor -> New query
-- Fully idempotent: safe to re-run.
-- ============================================================

-- 1) Enable useful extensions
create extension if not exists pgcrypto;

-- 2) Transactions table
create table if not exists public.transactions (
  id text primary key,
  ref_id text not null unique,
  timestamp timestamptz not null default now(),
  sender_phone text not null,
  recipient_phone text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'GHS',
  risk_score numeric(5,4) not null check (risk_score >= 0 and risk_score <= 1),
  risk_tier text not null check (risk_tier in ('approved', 'review', 'blocked')),
  feature_values jsonb not null default '{}'::jsonb,
  flagged_features jsonb not null default '[]'::jsonb,
  analyst_action text,
  analyst_note text,
  analyst_reason text,
  mfa_triggered boolean not null default false,
  actioned_at timestamptz,
  backend_action text,
  backend_reason text,
  backend_model_used boolean not null default false,
  sender_history jsonb not null default '{}'::jsonb,
  recipient_history jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Analyst actions table
create table if not exists public.analyst_actions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null references public.transactions(id) on delete cascade,
  action text not null,
  reason_code text,
  note text,
  created_at timestamptz not null default now()
);

-- 3b) Admin audit trail (written by the admin-users Edge Function)
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

-- 4) Helpful indexes
create index if not exists idx_transactions_timestamp
  on public.transactions(timestamp desc);

create index if not exists idx_transactions_risk_tier
  on public.transactions(risk_tier);

create index if not exists idx_analyst_actions_transaction_id
  on public.analyst_actions(transaction_id);

create index if not exists admin_actions_created_at_idx
  on public.admin_actions(created_at desc);

-- 5) Auto-update timestamp trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

-- 6) RLS
-- transactions SELECT/INSERT are restricted to authenticated users: the
-- dashboard is gated behind ProtectedRoute, so the realtime feed and mock
-- persistence run with a signed-in user's JWT. Anonymous sessions cannot read
-- the feed or inject rows. Risk-tier changes happen server-side only via the
-- analyst-actions Edge Function (service role, enforced role check).
alter table public.transactions enable row level security;
alter table public.analyst_actions enable row level security;
alter table public.admin_actions enable row level security;

drop policy if exists "transactions_public_select" on public.transactions;
drop policy if exists "transactions_auth_select" on public.transactions;
create policy "transactions_auth_select"
on public.transactions
for select to authenticated
using (true);

drop policy if exists "transactions_public_insert" on public.transactions;
drop policy if exists "transactions_auth_insert" on public.transactions;
create policy "transactions_auth_insert"
on public.transactions
for insert to authenticated
with check (true);

-- No UPDATE policy on public.transactions: risk-tier changes are performed
-- server-side only (Edge Function "analyst-actions", which uses the service
-- role and enforces the risk_manager/admin role check).

drop policy if exists "analyst_actions_public_select" on public.analyst_actions;
drop policy if exists "analyst_actions_auth_select" on public.analyst_actions;
create policy "analyst_actions_auth_select"
on public.analyst_actions
for select to authenticated
using (true);

drop policy if exists "analyst_actions_public_insert" on public.analyst_actions;
drop policy if exists "analyst_actions_auth_insert" on public.analyst_actions;
drop policy if exists "analyst_actions_manager_insert" on public.analyst_actions;
create policy "analyst_actions_manager_insert"
on public.analyst_actions
for insert to authenticated
with check ((auth.jwt() -> 'user_metadata' ->> 'role') in ('risk_manager', 'admin'));

-- admin_actions: writes come only from the service role (no INSERT policy).
-- Select is admin-only, enforced via the JWT user_metadata.role claim.
drop policy if exists "admin_actions_admin_select" on public.admin_actions;
create policy "admin_actions_admin_select"
on public.admin_actions
for select to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 7) Enable Supabase Realtime for the dashboard feed
-- Idempotent: adds a table to the publication only if not already a member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'analyst_actions'
  ) then
    alter publication supabase_realtime add table public.analyst_actions;
  end if;
end $$;

-- 8) Optional: rolling retention for the demo streaming feed.
-- The simulation inserts ~40k rows/day; purge rows older than 7 days hourly.
-- Requires pg_cron (available on hosted Supabase). Skip this block if your
-- plan does not expose pg_cron. analyst_actions cascade on delete, so the
-- audit trail is purged in lockstep.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fds_retention_cleanup';

select cron.schedule(
  'fds_retention_cleanup',
  '0 * * * *',
  $$
  delete from public.transactions
  where created_at < now() - interval '7 days';
  $$
);
