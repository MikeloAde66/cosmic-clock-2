-- Fixes a live-database mismatch discovered while testing 0006, the same
-- class of issue as 0002's posts.author_id fix and 0004's
-- kali_quantum_approvals fix: whatever actually got run for 0006 does not
-- match 0006_media_catalog.sql as written. Verified directly, not assumed:
--   - An insert with `status` omitted came back with status = 'QUEUED' —
--     but 0006 declares `status text not null default 'active'`.
--   - A follow-up insert with `status: 'not_a_real_status_value'`
--     succeeded — but 0006 declares
--     `check (status in ('active', 'archived'))`, which should have
--     rejected it outright.
-- Both point the same direction: the live table's actual column
-- definition/constraints differ from what 0006 specifies, not a bug in
-- routers/media.py's query (`.eq('status', 'active')`), which is why
-- GET /api/v1/media/catalog came back empty despite a successful insert.
--
-- Safe to drop and recreate: this table has only ever held throwaway rows
-- from this round of testing (Supabase Test Episode / Direct Insert Test /
-- Constraint Probe), never a real ingested item.

drop table if exists public.media_catalog cascade;

create table public.media_catalog (
  id uuid primary key default gen_random_uuid(),
  raw_title text not null,
  url text not null,
  channel text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.media_catalog enable row level security;
alter table public.media_catalog force row level security;

revoke all on public.media_catalog from anon, authenticated;

create index media_catalog_status_idx on public.media_catalog (status);
create index media_catalog_created_at_idx on public.media_catalog (created_at desc);
