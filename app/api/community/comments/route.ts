export const runtime = 'nodejs';

import { supabase } from '@/lib/supabase';
import { requireUser, UserAuthError } from '@/lib/supabaseForUser';
import type { CommunityAuthor } from '../posts/route';

export interface CommunityComment {
  id: string;
  post_id: string;
  content: string;
  author_id: string;
  created_at: string;
  author: CommunityAuthor | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('postId');
  if (!postId) {
    return new Response('postId query param is required.', { status: 400 });
  }

  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, content, author_id, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = data ?? [];
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const byId = new Map<string, CommunityAuthor>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, handle, display_name, avatar_url').in('id', authorIds);
    for (const p of profiles ?? []) byId.set(p.id, p as CommunityAuthor);
  }

  const comments: CommunityComment[] = rows.map((r) => ({ ...r, author: byId.get(r.author_id) ?? null }));
  return Response.json({ comments });
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

  const { postId, content } = body;
  if (typeof postId !== 'string' || !postId.trim()) {
    return new Response('postId is required.', { status: 400 });
  }
  if (typeof content !== 'string' || !content.trim() || content.length > 4000) {
    return new Response('content is required (max 4000 characters).', { status: 400 });
  }

  // As with posts, this goes through as the calling user so the
  // "Signed-in users can create their own comments" RLS policy is what
  // actually enforces author_id = auth.uid(), not application code.
  const { data, error } = await user.supabase
    .from('comments')
    .insert({ post_id: postId, content: content.trim(), author_id: user.id })
    .select('id, post_id, content, author_id, created_at')
    .single();

  if (error) {
    return new Response(error.message, { status: 500 });
  }
  return Response.json({ comment: { ...data, author: null } satisfies CommunityComment }, { status: 201 });
}
