-- RLS hardening: block anonymous risk-tier updates and scope audit writes.
-- Companion to the "analyst-actions" and "admin-users" Edge Functions.

-- transactions: keep SELECT/INSERT open for the demo streaming engine + feed,
-- but REMOVE the open UPDATE policy. Risk-tier changes now go through the
-- analyst-actions Edge Function (service role, enforced role check).
drop policy if exists "transactions_public_update" on public.transactions;

-- analyst_actions: no more anonymous writes. Audit entries are inserted by the
-- Edge Functions via the service role; select/insert restricted to authenticated.
drop policy if exists "analyst_actions_public_select" on public.analyst_actions;
drop policy if exists "analyst_actions_public_insert" on public.analyst_actions;

create policy "analyst_actions_auth_select"
on public.analyst_actions
for select to authenticated
using (true);

create policy "analyst_actions_auth_insert"
on public.analyst_actions
for insert to authenticated
with check (true);
