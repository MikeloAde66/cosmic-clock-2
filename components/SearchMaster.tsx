'use client';

import React, { useState } from 'react';

interface SearchResult {
  id: number;
  title: string;
  snippet: string;
}

export default function SearchMaster() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setOpen(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex items-center">
        <svg
          className={`absolute left-2.5 w-3.5 h-3.5 ${
            loading ? 'text-amber-500 animate-pulse' : 'text-neutral-400'
          } pointer-events-none`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          placeholder={loading ? 'Searching...' : 'Search masters...'}
          className="w-48 py-1 pl-8 pr-3 text-xs border rounded bg-neutral-900 border-neutral-700 text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
      </form>

      {/* Results Dropdown */}
      {open && (
        <div className="absolute right-0 z-50 p-3 mt-2 text-xs border rounded-md shadow-xl w-72 bg-neutral-900 border-neutral-800">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-neutral-800 text-neutral-400">
<span>{`Results for "${query}"`}</span>            <button
              onClick={() => setOpen(false)}
              className="hover:text-neutral-200"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <p className="py-2 text-neutral-500">Querying neural index...</p>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="p-2 transition-all border rounded cursor-pointer bg-neutral-950/60 border-neutral-800/80 hover:border-amber-500/50"
                >
                  <p className="font-semibold text-amber-400">{item.title}</p>
                  <p className="text-neutral-400 mt-1 text-[11px]">
                    {item.snippet}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-neutral-500">No records found.</p>
          )}
        </div>
      )}
    </div>
  );
}