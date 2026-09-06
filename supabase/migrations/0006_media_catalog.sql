-- Backing store for Media Flow & Audio Center's "Your Catalog" section
-- (components/MediaFlowAudioCenter.tsx), replacing the FastAPI backend's
-- earlier in-memory list (routers/media.py) with real persistence across
-- restarts/workers. Written by POST /api/v1/media/ingest, read by
-- GET /api/v1/media/catalog — both exclusively via the service-role
-- client in services/supabase_client.py, same "admin-only, service-role
-- only" pattern as 0003/0005's kali_quantum_approvals (not the community
-- forum's user-facing RLS pattern), since this table is never queried
-- with a user's own JWT. RLS is enabled+forced with privileges revoked
-- from anon/authenticated immediately, rather than relying on "enable RLS
-- with no policies" alone to deny access by default — 0003-0005 already
-- showed that assumption failing to hold on this project's live database.
--
-- How to apply: paste this file into the Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query) and run it once — same manual
-- step 0001's header describes; there's still no Supabase CLI project
-- linked in this repo.

create table if not exists public.media_catalog (
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

create index if not exists media_catalog_status_idx on public.media_catalog (status);
create index if not exists media_catalog_created_at_idx on public.media_catalog (created_at desc);
