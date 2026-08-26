-- Backing store for the Kali quantum-task approval dashboard
-- (components/kali/QuantumApprovalModal.tsx).
--
-- Real gap this closes: aws/step-functions/kali-quantum-workflow.json
-- publishes a pending-approval message to SNS, but nothing was ever
-- subscribed to receive and persist it anywhere queryable — a dashboard
-- can't "poll for pending tasks" if no pending task is ever stored. This
-- table is what app/api/kali/sns-webhook (an SNS HTTPS subscription
-- target) writes into, and what app/api/kali/pending-approvals reads
-- from.
--
-- Admin-only, exclusively via the service-role client in app/api/kali/*
-- routes (see lib/adminAuth.ts's requireAdmin) - same pattern as the
-- vault routes, not the community forum's user-facing RLS pattern, since
-- this is an internal ops tool, not a public one. RLS is enabled with no
-- permissive policies anyway, as defense-in-depth: even a valid user JWT
-- can never read this table directly, only the service-role key can.
create table if not exists public.kali_quantum_approvals (
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

create index if not exists kali_quantum_approvals_status_idx on public.kali_quantum_approvals (status);
