export const runtime = 'nodejs';

import { supabase } from '@/lib/supabase';
import { requireUser, UserAuthError } from '@/lib/supabaseForUser';
import { isCommunityCategory, COMMUNITY_CATEGORIES } from '@/lib/communityCategories';

export interface CommunityAuthor {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author_id: string;
  created_at: string;
  author: CommunityAuthor | null;
}

// posts.author_id references auth.users, not public.profiles directly (a
// user can post before ever filling in a profile — see the migration's own
// comment), so there's no foreign key PostgREST can use to embed profiles
// automatically. A second query for just the authors that showed up in
// this page of posts, merged here, does the same job explicitly.
async function attachAuthors(rows: Omit<CommunityPost, 'author'>[]): Promise<CommunityPost[]> {
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  if (authorIds.length === 0) return rows.map((r) => ({ ...r, author: null }));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url')
    .in('id', authorIds);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p as CommunityAuthor]));
  return rows.map((r) => ({ ...r, author: byId.get(r.author_id) ?? null }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  if (category && !isCommunityCategory(category)) {
    return new Response(`category must be one of: ${COMMUNITY_CATEGORIES.map((c) => c.value).join(', ')}.`, {
      status: 400,
    });
  }

  let query = supabase
    .from('posts')
    .select('id, title, content, category, tags, author_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) {
    // Most likely cause during initial setup: the migration hasn't been
    // run against this Supabase project yet (relation "posts" does not
    // exist) — surfaced as a real error, not silently swallowed, so it's
    // obvious what's missing rather than looking like an empty forum.
    return new Response(error.message, { status: 500 });
  }

  const posts = await attachAuthors(data ?? []);
  return Response.json({ posts });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (err) {
    if (err instanceof UserAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { title, content, category, tags } = body;
  if (typeof title !== 'string' || !title.trim() || title.length > 200) {
    return new Response('title is required (max 200 characters).', { status: 400 });
  }
  if (typeof content !== 'string' || !content.trim() || content.length > 10000) {
    return new Response('content is required (max 10000 characters).', { status: 400 });
  }
  if (!isCommunityCategory(category)) {
    return new Response(`category must be one of: ${COMMUNITY_CATEGORIES.map((c) => c.value).join(', ')}.`, {
      status: 400,
    });
  }
  const tagList = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string').slice(0, 10) : [];

  // Goes through as the calling user (see lib/supabaseForUser.ts), so the
  // "Signed-in users can create their own posts" RLS policy — auth.uid()
  // = author_id — is what actually enforces this, not this route's own
  // logic. A mismatched author_id here would simply be rejected by
  // Postgres, not silently accepted.
  const { data, error } = await user.supabase
    .from('posts')
    .insert({ title: title.trim(), content: content.trim(), category, tags: tagList, author_id: user.id })
    .select('id, title, content, category, tags, author_id, created_at')
    .single();

  if (error) {
    return new Response(error.message, { status: 500 });
  }
  return Response.json({ post: { ...data, author: null } satisfies CommunityPost }, { status: 201 });
}
