-- Fixes a live-database mismatch discovered while testing 0003, the same
-- class of issue as 0002's posts.author_id fix: whatever was actually run
-- for 0003 does not match 0003_kali_quantum_approvals.sql as written.
-- Verified directly, not assumed:
--   - A plain insert with qubit_count omitted (null) failed with
--     "null value in column qubit_count violates not-null constraint" -
--     but 0003 declares `qubit_count integer` with no NOT NULL at all.
--   - The webhook's upsert (`ON CONFLICT (task_token)`) failed with
--     "no unique or exclusion constraint matching the ON CONFLICT
--     specification" - but 0003 declares `task_token text not null
--     unique`, which should create exactly that constraint.
-- Both point the same direction: the live table's actual column
-- definitions differ from what 0003 specifies, not a bug in the
-- application code that queries it.
--
-- Safe to drop and recreate: this table has never held a row from a real
-- SNS notification (every attempt so far either failed outright or was a
-- throwaway test cleaned up immediately after).

drop table if exists public.kali_quantum_approvals cascade;

create table public.kali_quantum_approvals (
  id uuid primary key default gen_random_uuid(),
  task_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  qubit_count integer,
  target_qpu text,
  estimated_cost_usd numeric,
  circuit_summary text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id)
);

alter table public.kali_quantum_approvals enable row level security;

create index kali_quantum_approvals_status_idx on public.kali_quantum_approvals (status);
