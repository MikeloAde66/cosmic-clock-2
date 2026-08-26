-- Fixes a live-database mismatch discovered while testing 0001: the
-- deployed public.posts table's author_id foreign key did not actually
-- match what 0001_community_forum.sql specifies (author_id references
-- auth.users, not public.profiles) — most likely because a posts table
-- already existed in this project before 0001 ran, so its
-- `create table if not exists` was a silent no-op. Verified live: an
-- end-to-end test (real throwaway user, created/signed-in/deleted via the
-- Supabase Admin API) showed even a raw service-role insert into posts
-- failing with "violates foreign key constraint posts_author_id_fkey" for
-- a user confirmed to exist in auth.users.
--
-- This re-creates posts from the exact 0001 definition (safe: the table
-- had never held a successfully-created row, confirmed by that same
-- test), and adds an auto-create-profile-on-signup trigger — a genuine
-- improvement regardless of the above, and also what finally makes
-- components/SignUpModal.tsx's existing best-effort
-- `.from('profiles').upsert(...)` call meaningful (it upserts on top of
-- whatever this trigger already created, rather than being the only thing
-- that ever creates a profiles row).

drop table if exists public.posts cascade;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 10000),
  category public.community_category not null,
  tags text[] not null default '{}',
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Posts are publicly readable"
  on public.posts for select using (true);
create policy "Signed-in users can create their own posts"
  on public.posts for insert with check (auth.uid() = author_id);
create policy "Authors can update their own posts"
  on public.posts for update using (auth.uid() = author_id);
create policy "Authors can delete their own posts"
  on public.posts for delete using (auth.uid() = author_id);

create index posts_category_idx on public.posts (category);
create index posts_created_at_idx on public.posts (created_at desc);

-- Auto-create a profiles row on signup — real columns from
-- 0001_community_forum.sql (handle/display_name/avatar_url), not the
-- username/full_name shape a generic Supabase-tutorial trigger would use.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
