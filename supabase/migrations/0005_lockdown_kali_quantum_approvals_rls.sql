-- Fixes a live, real security exposure found during end-to-end testing:
-- the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, exposed by design in the
-- client-side bundle) could read public.kali_quantum_approvals directly
-- via the Supabase REST API, completely bypassing app/api/kali/*'s
-- requireAdmin check. Verified directly: an anon-key client with no user
-- session at all successfully selected the row a real SNS notification
-- had just inserted.
--
-- 0003/0004 both say `alter table ... enable row level security` with no
-- policies, which should deny all non-owner access by default in
-- Postgres - but this is now the THIRD time this specific table's live
-- state has diverged from what its migration file says, so this migration
-- doesn't just re-assert RLS and trust it took effect this time. It also
-- explicitly revokes the table-level privileges Supabase grants anon/
-- authenticated on every new public table by default (GRANT ALL ON ALL
-- TABLES IN SCHEMA public) - a second, independent layer that protects
-- this table even if RLS enablement were silently skipped again.

alter table public.kali_quantum_approvals enable row level security;
alter table public.kali_quantum_approvals force row level security;

revoke all on public.kali_quantum_approvals from anon, authenticated;

-- Defensive: drop a few plausible permissive-policy names in case one was
-- added via a Studio "quick start" template (e.g. its common
-- "Enable read access for all users" suggestion) rather than left with
-- zero policies as originally intended.
drop policy if exists "Enable read access for all users" on public.kali_quantum_approvals;
drop policy if exists "Enable insert for authenticated users only" on public.kali_quantum_approvals;
drop policy if exists "Public read access" on public.kali_quantum_approvals;

-- After this runs, confirm nothing is listed here (expected: zero rows):
--   select * from pg_policies where tablename = 'kali_quantum_approvals';
