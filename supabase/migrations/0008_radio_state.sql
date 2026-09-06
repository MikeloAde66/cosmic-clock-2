-- Backend-controllable radio broadcast state (Program Manager / Daily
-- Queue), so external automations (n8n) can start/stop the live
-- front-page broadcast remotely via POST /api/v1/radio/toggle, rather
-- than these being purely client-side React state with no outside
-- control surface (see components/radio/RadioPlayerContext.tsx's
-- programManagerEnabled/dailyQueueEnabled). Read by every client via
-- GET /api/v1/radio/state (polled — see RadioCentralConsoleView.tsx) and
-- applied locally by calling the exact same startDailyQueue/
-- toggleProgramManager the manual toggle buttons already use — remote
-- state is treated as authoritative, the same way a real remote control
-- overrides a manual switch.
--
-- Admin-only, service-role client (routers/radio.py) — same pattern as
-- 0003/0005's kali_quantum_approvals: RLS enabled+forced with privileges
-- revoked from anon/authenticated immediately, rather than relying on
-- "enable RLS with no policies" alone (0003-0005 already showed that
-- assumption failing to hold on this project's live database).

create table if not exists public.radio_state (
  key text primary key check (key in ('daily_queue', 'program_manager')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.radio_state (key, enabled) values
  ('daily_queue', false),
  ('program_manager', false)
on conflict (key) do nothing;

alter table public.radio_state enable row level security;
alter table public.radio_state force row level security;

revoke all on public.radio_state from anon, authenticated;
