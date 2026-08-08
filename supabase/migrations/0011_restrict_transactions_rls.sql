-- M6: Restrict transactions RLS to authenticated; harden analyst_actions inserts.
-- The dashboard is gated behind ProtectedRoute, so the realtime feed and mock
-- persistence run with a signed-in user's JWT and continue to work. Anonymous
-- sessions can no longer read the feed or inject rows, and non-managers can no
-- longer forge audit entries directly through the PostgREST client (writes go
-- through the analyst-actions Edge Function via the service role, which
-- bypasses RLS entirely).

-- 1) transactions: SELECT/INSERT tighten from anon to authenticated.
drop policy if exists "transactions_public_select" on public.transactions;
drop policy if exists "transactions_public_insert" on public.transactions;

create policy "transactions_auth_select"
on public.transactions
for select to authenticated
using (true);

create policy "transactions_auth_insert"
on public.transactions
for insert to authenticated
with check (true);

-- 2) analyst_actions: select stays open to any authenticated user (audit
-- viewers), but direct inserts are restricted to risk managers/admins.
drop policy if exists "analyst_actions_auth_insert" on public.analyst_actions;

create policy "analyst_actions_manager_insert"
on public.analyst_actions
for insert to authenticated
with check ((auth.jwt() -> 'user_metadata' ->> 'role') in ('risk_manager', 'admin'));
