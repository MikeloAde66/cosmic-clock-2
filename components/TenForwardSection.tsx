'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { COMMUNITY_CATEGORIES, categoryLabel, isCommunityCategory, type CommunityCategory } from '@/lib/communityCategories';
import AuthModal from './AuthModal';
import type { CommunityAuthor, CommunityPost } from '@/app/api/community/posts/route';
import type { CommunityComment } from '@/app/api/community/comments/route';

interface TenForwardSectionProps {
  // Only set when opened as its own dedicated view (via LeftNav's "Let's
  // Chat" icon, or the Gallery Grid's Digital Magazine card) — renders the
  // fixed-overlay + Back button chrome that StarTrackerView uses. Omitted
  // when embedded inline as a Continuous Stack section, where the page
  // itself owns the scroll.
  onBack?: () => void;
}

function authorLabel(author: CommunityAuthor | null, fallbackId: string) {
  return author?.display_name || author?.handle || `User ${fallbackId.slice(0, 6)}`;
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Same session-token pattern already used in ProductDetailView.tsx,
// CosmicVaultAuth.tsx, and app/admin/radio-stations/page.tsx.
async function getAuthHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function CommentThread({ postId, canPost, onRequireSignIn }: { postId: string; canPost: boolean; onRequireSignIn: () => void }) {
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/comments?postId=${encodeURIComponent(postId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load replies.');
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) {
      onRequireSignIn();
      return;
    }
    if (!draft.trim()) return;
    setPosting(true);
    setError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ postId, content: draft }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="pt-3 mt-3 space-y-2 border-t border-slate-800">
      {comments === null && !error && <p className="text-xs text-slate-500">Loading replies…</p>}
      {comments?.length === 0 && <p className="text-xs text-slate-600">No replies yet.</p>}
      {comments?.map((c) => (
        <div key={c.id}>
          <span className="text-xs font-bold text-slate-300">{authorLabel(c.author, c.author_id)}</span>
          <span className="ml-2 text-[11px] text-slate-600">{relativeTime(c.created_at)}</span>
          <p className="mt-0.5 text-xs text-slate-400">{c.content}</p>
        </div>
      ))}
      <form onSubmit={submitComment} className="flex gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={canPost ? 'Reply...' : 'Sign in to reply...'}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={posting || (canPost && !draft.trim())}
          className="flex items-center justify-center px-2.5 py-1.5 text-xs font-bold rounded bg-white text-black hover:bg-neutral-200 disabled:opacity-40"
          aria-label="Send reply"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function PostCard({ post, canPost, onRequireSignIn }: { post: CommunityPost; canPost: boolean; onRequireSignIn: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 border rounded-xl border-slate-800/80 bg-slate-950/40">
      <div className="flex items-center justify-between gap-2">
        <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide rounded-full bg-slate-900 border border-slate-700 text-slate-400">
          {categoryLabel(post.category as CommunityCategory)}
        </span>
        <span className="text-[11px] text-slate-600">{relativeTime(post.created_at)}</span>
      </div>
      <h3 className="mt-2 text-sm font-bold text-white">{post.title}</h3>
      <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-slate-400">{post.content}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-slate-500">{authorLabel(post.author, post.author_id)}</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-mono uppercase text-slate-500 hover:text-white transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          {expanded ? 'Hide replies' : 'Replies'}
        </button>
      </div>
      {expanded && <CommentThread postId={post.id} canPost={canPost} onRequireSignIn={onRequireSignIn} />}
    </div>
  );
}

// Continuous Stack section / dedicated view — "Let's Chat" community hub
// (previously "Ten Forward"), now the Digital Magazine card's destination
// too. Real Supabase-backed posts/comments (see
// supabase/migrations/0001_community_forum.sql and app/api/community/*) —
// an honest empty state ("no threads yet") still shows when the forum
// genuinely has no posts, same principle as before, just backed by a real
// database instead of always being empty.
function TenForwardContent() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [session, setSession] = useState<boolean | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommunityCategory>(COMMUNITY_CATEGORIES[0].value);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/community/posts');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPosts(data.posts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load the feed.');
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, sess) => setSession(!!sess));
    return () => subscription.subscription.unsubscribe();
  }, []);

  const canPost = session === true;

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) {
      setShowAuth(true);
      return;
    }
    if (!title.trim() || !content.trim()) return;
    setPosting(true);
    setPostError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, content, category }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle('');
      setContent('');
      await loadPosts();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Let&apos;s Chat</h2>
        <p className="mt-1 text-sm text-slate-400">
          Digital Magazine &amp; community hub — stories, discussions, and project reviews from tech lovers, off-grid
          explorers, stargazers, DIYers, and everyday creators.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Composer + feed */}
        <div className="space-y-4">
          <form
            onSubmit={submitPost}
            className="p-5 space-y-3 border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-white/70">Start a discussion</span>
              <select
                value={category}
                onChange={(e) => isCommunityCategory(e.target.value) && setCategory(e.target.value)}
                className="px-2 py-1 text-xs bg-black/40 border border-slate-800 rounded text-slate-300 outline-none focus:border-white/40"
              >
                {COMMUNITY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => !canPost && setShowAuth(true)}
              placeholder="Title..."
              maxLength={200}
              className="w-full px-3 py-2 text-sm bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/40"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => !canPost && setShowAuth(true)}
              placeholder="Share a project, question, or story..."
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 text-sm bg-black/40 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/40 resize-none"
            />
            <div className="flex items-center justify-between">
              {postError && <p className="text-[11px] text-red-400">{postError}</p>}
              <button
                type="submit"
                disabled={posting}
                className="ml-auto px-4 py-2 text-xs font-bold uppercase tracking-wide rounded bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {!canPost ? 'Sign in to post' : posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>

          <div className="p-5 border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
            {loadError && <p className="text-xs text-red-400">{loadError}</p>}
            {posts === null && !loadError && <p className="text-sm text-slate-500">Loading the feed…</p>}
            {posts?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl border-slate-800 text-slate-500">
                <MessageSquare className="w-6 h-6 mb-2" />
                <p className="text-sm">No threads yet.</p>
                <p className="mt-1 text-xs text-slate-600">Be the first to start a discussion.</p>
              </div>
            )}
            {posts && posts.length > 0 && (
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} canPost={canPost} onRequireSignIn={() => setShowAuth(true)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categories — a quick-glance sidebar, not a filter UI yet. */}
        <div className="flex flex-col gap-4">
          <div className="px-4 py-3 border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
            <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">Categories</p>
            <div className="flex flex-col gap-1.5">
              {COMMUNITY_CATEGORIES.map((c) => (
                <span key={c.value} className="text-xs text-slate-400">
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} initialMode="login" />
    </div>
  );
}

export default function TenForwardSection({ onBack }: TenForwardSectionProps) {
  if (onBack) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col w-full h-full p-4 overflow-y-auto bg-[#050810] text-slate-100">
        <div className="relative z-10 flex items-center gap-2 mb-4 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
        <TenForwardContent />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-16">
      <TenForwardContent />
    </div>
  );
}
