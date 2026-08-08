-- M1: Rolling retention for the demo streaming feed.
-- The simulation inserts ~40k rows/day into public.transactions. Without a
-- cleanup this grows without bound (the frontend only caps its in-memory list
-- at 300 rows). This schedules an hourly purge of rows older than 7 days.
--
-- NOTE: analyst_actions cascade on delete from transactions, so the audit
-- trail is purged in lockstep. Raise the retention window if you need longer
-- audit history. Writes via the analyst-actions Edge Function (service role)
-- are unaffected.
--
-- Requires the pg_cron extension (available on hosted Supabase). If your plan
-- does not expose pg_cron, delete this migration or run the DELETE manually.

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
