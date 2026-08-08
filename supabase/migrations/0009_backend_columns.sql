-- Add backend model columns to transactions: the frontend persists the FastAPI
-- prediction alongside the mock transaction when the backend is reachable.
alter table public.transactions
  add column if not exists backend_action text,
  add column if not exists backend_reason text,
  add column if not exists backend_model_used boolean not null default false;
