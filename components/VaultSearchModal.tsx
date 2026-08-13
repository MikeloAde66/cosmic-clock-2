'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { VaultDrawer, VaultProduct } from '@/lib/vaultRegistry';

interface VaultSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
}

interface SearchResult {
  product: VaultProduct;
  score: number;
  // Which field the best match came from, shown as a small hint under the
  // title when it wasn't the title itself that matched.
  matchedOn: 'title' | 'sku' | 'drawer' | 'description' | 'filename' | 'tag';
  matchedFilename?: string;
  matchedTag?: string;
}

// No fuzzy-search dependency in this repo, and this only ever ranks a few
// dozen local items client-side, so a small hand-rolled scorer is enough:
// exact substrings score highest (earlier position = better), a
// character-subsequence match (all query chars in order, gaps allowed)
// scores lower, and anything that doesn't even subsequence-match is
// excluded entirely.
function fuzzyScore(text: string, query: string): number {
  if (!text || !query) return -1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  const idx = t.indexOf(q);
  if (idx !== -1) {
    return 100 - idx * 0.5 + (q.length / t.length) * 20;
  }

  let ti = 0;
  let qi = 0;
  let gaps = 0;
  let firstMatch = -1;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      if (firstMatch === -1) firstMatch = ti;
      qi += 1;
    } else if (firstMatch !== -1) {
      gaps += 1;
    }
    ti += 1;
  }
  if (qi < q.length) return -1;
  return 40 - gaps * 0.5 - firstMatch * 0.2;
}

function rankProducts(products: VaultProduct[], query: string): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: SearchResult[] = [];
  for (const product of products) {
    // Title, SKU, and tags are the most useful things to land a jump on, so
    // they're weighted above drawer/description/filename matches.
    const candidates: { field: SearchResult['matchedOn']; score: number; filename?: string; tag?: string }[] = [
      { field: 'title', score: fuzzyScore(product.title, trimmed) * 1.5 },
      { field: 'sku', score: fuzzyScore(product.sku, trimmed) * 1.4 },
      { field: 'drawer', score: fuzzyScore(product.drawer, trimmed) },
      { field: 'description', score: fuzzyScore(product.description, trimmed) * 0.6 },
    ];
    for (const tag of product.tags ?? []) {
      const s = fuzzyScore(tag, trimmed) * 1.3;
      if (s >= 0) candidates.push({ field: 'tag', score: s, tag });
    }
    for (const track of product.tracks ?? []) {
      const s = fuzzyScore(track.filename, trimmed) * 0.8;
      if (s >= 0) candidates.push({ field: 'filename', score: s, filename: track.filename });
    }

    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a), { field: 'title' as const, score: -1 });
    if (best.score >= 0) {
      results.push({
        product,
        score: best.score,
        matchedOn: best.field,
        matchedFilename: best.filename,
        matchedTag: best.tag,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}

export default function VaultSearchModal({ isOpen, onClose, onNavigateToVaultDrawer }: VaultSearchModalProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<VaultProduct[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => rankProducts(products, query), [products, query]);

  // "Adjust state during render" (react.dev's own alternative to an effect
  // for this exact case) instead of useEffect + setState: reset the query
  // on the isOpen false->true transition, and reset the selection whenever
  // the query changes (including that reset) — one source of truth, no
  // extra render-triggered-by-an-effect cascade.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setQuery('');
  }
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  // Fetch the vault index lazily, once — reuses the same unauthenticated
  // GET /api/vault/list the admin inventory view already relies on, so this
  // doesn't introduce a new access surface beyond what's already there.
  useEffect(() => {
    if (!isOpen || hasFetched) return;
    setLoading(true);
    fetch('/api/vault/list')
      .then((res) => res.json())
      .then((data: { products: VaultProduct[] }) => setProducts(data.products || []))
      .catch((err) => console.error('Failed to load Vault search index:', err))
      .finally(() => {
        setLoading(false);
        setHasFetched(true);
      });
  }, [isOpen, hasFetched]);

  // Imperative DOM focus, not a state update — a legitimate effect.
  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  if (!isOpen) return null;

  const jumpTo = (result: SearchResult) => {
    onNavigateToVaultDrawer(result.product.drawer);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result) jumpTo(result);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden border shadow-2xl rounded-xl border-neutral-700 bg-slate-950/95 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search drawers, files, SKUs…"
            className="flex-1 py-3 text-sm bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 border rounded border-slate-700 shrink-0">
            ESC
          </kbd>
        </div>

        <div className="overflow-y-auto max-h-80">
          {loading ? (
            <p className="p-4 font-mono text-xs text-slate-500">Loading Vault index…</p>
          ) : query.trim() === '' ? (
            <p className="p-4 font-mono text-xs text-slate-500">Type to search across drawers, files, and SKUs.</p>
          ) : results.length === 0 ? (
            <p className="p-4 font-mono text-xs text-slate-500">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            results.map((result, i) => (
              <button
                key={result.product.id}
                onClick={() => jumpTo(result)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex items-center justify-between w-full gap-3 px-4 py-2.5 text-left transition ${
                  i === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{result.product.title}</p>
                  <p className="font-mono text-[10px] text-slate-500 truncate">
                    {result.matchedOn === 'filename' && result.matchedFilename
                      ? `in: ${result.matchedFilename}`
                      : result.matchedOn === 'tag' && result.matchedTag
                        ? `tag: ${result.matchedTag}`
                        : `SKU: ${result.product.sku}`}
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide text-slate-300 border rounded shrink-0 border-slate-700 bg-slate-900/80">
                  {result.product.drawer}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 font-mono text-[10px] text-slate-500 border-t border-slate-800">
          <span className="flex items-center gap-1">
            <kbd className="px-1 border rounded border-slate-700">↑</kbd>
            <kbd className="px-1 border rounded border-slate-700">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 border rounded border-slate-700">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 border rounded border-slate-700">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
