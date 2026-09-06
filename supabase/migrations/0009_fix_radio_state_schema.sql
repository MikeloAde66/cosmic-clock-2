-- Fixes a live-database mismatch discovered while testing 0008, the same
-- class of issue as 0002/0004/0007: whatever actually got run for 0008
-- does not match 0008_radio_state.sql as written. Verified directly, not
-- assumed: a real select against the live table returned rows shaped
-- {id: 'on_air', enabled, updated_at} and {id: 'daily_queue', ...} — but
-- 0008 declares a `key` primary key column (not `id`) constrained to
-- ('daily_queue', 'program_manager') — no `key` column and no
-- 'program_manager' row existed at all. That's why every request from
-- routers/radio.py failed: its select("key, enabled") and upsert({"key":
-- ...}) both referenced a column that was never actually created.
--
-- The schema-creating statements below were verified applied and working
-- (a real POST /api/v1/radio/toggle round trip against this exact schema
-- succeeded) before this file was updated to add the RLS lockdown that
-- follows — split out from the original attempt specifically to isolate
-- whether the DDL itself or the lockdown statements were the problem.
--
-- Safe to drop and recreate: this table has only ever held seed/test
-- rows, never a real toggle from a real automation.

drop table if exists public.radio_state cascade;

create table public.radio_state (
  key text primary key check (key in ('daily_queue', 'program_manager')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.radio_state (key, enabled) values
  ('daily_queue', false),
  ('program_manager', false);

-- Admin-only, service-role client (routers/radio.py) — same pattern as
-- 0003/0005's kali_quantum_approvals: RLS enabled+forced with privileges
-- revoked from anon/authenticated immediately, rather than relying on
-- "enable RLS with no policies" alone (0003-0005 already showed that
-- assumption failing to hold on this project's live database).
alter table public.radio_state enable row level security;
alter table public.radio_state force row level security;

revoke all on public.radio_state from anon, authenticated;
