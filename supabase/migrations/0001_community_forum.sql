-- Digital Magazine / Community Hub ("Let's Chat") — posts, comments, and a
-- minimal profiles table for display handles/avatars.
--
-- This is the FIRST real Postgres schema in this project. Every other
-- authenticated route in the app (see app/api/vault/*, lib/adminAuth.ts)
-- enforces permissions manually in route-handler code using the
-- service-role client, which bypasses RLS entirely — there was no
-- precedent here to extend. This schema uses real Postgres Row Level
-- Security instead, because that's what was explicitly asked for and is a
-- better fit for a public forum: ownership rules ("you can only edit your
-- own post") live once in the database instead of being re-checked by
-- hand in every route that touches these tables, now or later.
--
-- How to apply: paste this file into the Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query) and run it once. There's no
-- Supabase CLI project linked in this repo (no supabase/config.toml), so
-- this isn't wired to `supabase db push` — running it by hand is the
-- straightforward path until/unless the project adopts the CLI.

-- ---------------------------------------------------------------------
-- profiles — one row per authenticated user. Referenced (not required)
-- by posts/comments for a display handle/avatar; a user who never fills
-- this in still has real posts under their auth.users id, just displayed
-- with an email-derived fallback name (see the API routes).
--
-- mailing_address/preferences: components/SignUpModal.tsx already has a
-- best-effort `.from('profiles').upsert({ id, mailing_address, preferences
-- })` call (its own comment even flags "a profiles table may not exist
-- yet"). It doesn't — this migration is what first creates it — so that
-- upsert has been silently failing every time (the call swallows its own
-- error). Including these two columns here means that existing code path
-- starts actually working instead of staying broken after this migration
-- adds the table out from under it with an incompatible shape.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  mailing_address text,
  preferences text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------
do $$ begin
  create type public.community_category as enum (
    'tech_hardware',
    'off_grid_nature',
    'diy_inventions',
    'cosmic_stargazing'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 10000),
  category public.community_category not null,
  tags text[] not null default '{}',
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable"
  on public.posts for select
  using (true);

drop policy if exists "Signed-in users can create their own posts" on public.posts;
create policy "Signed-in users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "Authors can update their own posts" on public.posts;
create policy "Authors can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id);

drop policy if exists "Authors can delete their own posts" on public.posts;
create policy "Authors can delete their own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

create index if not exists posts_category_idx on public.posts (category);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "Comments are publicly readable" on public.comments;
create policy "Comments are publicly readable"
  on public.comments for select
  using (true);

drop policy if exists "Signed-in users can create their own comments" on public.comments;
create policy "Signed-in users can create their own comments"
  on public.comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete their own comments" on public.comments;
create policy "Authors can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

create index if not exists comments_post_id_idx on public.comments (post_id);
