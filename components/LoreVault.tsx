'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface PodcastFile {
  name: string;
  format: string;
  url: string;
}

interface VaultItem {
  identifier: string;
  title: string;
  creator?: string;
  date?: string;
  description?: string;
  details_url?: string;
  audio_files?: PodcastFile[];
}

export default function LoreVault() {
  const [query, setQuery] = useState('cosmology');
  const [results, setResults] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchVaultData = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch(
        `http://localhost:8000/search/podcasts?query=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error(`Vault API error (${response.status})`);
      }

      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn('Vault fetch issue:', err.message);
      } else {
        console.warn('Vault fetch issue:', err);
      }
      setErrorMsg('Vault backend unavailable or request failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVaultData('cosmology');
  }, [fetchVaultData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVaultData(query);
  };

  return (
    <div className="flex flex-col w-full max-w-6xl gap-6 mx-auto">
      {/* Header & Search Bar */}
      <div className="flex flex-col items-center justify-between gap-4 pb-6 border-b md:flex-row border-slate-800">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-widest uppercase text-amber-400">
            Cosmic Lore Vault
          </h1>
          <p className="font-mono text-xs text-slate-400">
            CHRONOLOGICAL ARCHIVES &amp; COSMOLOGICAL RESEARCH
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative w-full md:w-96">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault archives..."
            className="w-full px-4 py-2 text-sm transition-colors border rounded-lg bg-slate-900/90 border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
          />
          <button
            type="submit"
            className="absolute right-3 top-2.5 text-slate-400 hover:text-amber-400 text-xs font-mono"
          >
            {loading ? '...' : '🔍'}
          </button>
        </form>
      </div>

      {/* Non-blocking Error Banner */}
      {errorMsg && (
        <div className="p-4 font-mono text-xs border rounded-lg bg-amber-500/10 border-amber-500/30 text-amber-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="py-12 font-mono text-xs text-center text-amber-400/80 animate-pulse">
          FETCHING COSMIC ARCHIVES...
        </div>
      )}

      {/* Results Grid */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {results.map((item, idx) => {
            const mainAudio =
              item.audio_files?.find(
                (f) =>
                  f.format?.toLowerCase().includes('mp3') ||
                  f.url?.endsWith('.mp3')
              ) || item.audio_files?.[0];

            return (
              <div
                key={item.identifier || idx}
                className="flex flex-col justify-between gap-4 p-5 transition-all border rounded-xl bg-slate-900/50 border-slate-800/80 backdrop-blur-md hover:border-slate-700"
              >
                <div>
                  <h3 className="font-mono text-base font-bold text-amber-400 line-clamp-1">
                    {item.title || 'Untitled Archive Record'}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    Creator: {item.creator || 'Unknown Source'}
                  </p>
                  {item.description && (
                    <p className="mt-3 text-xs text-slate-300 line-clamp-3">
                      {item.description}
                    </p>
                  )}
                </div>

                {mainAudio?.url && (
                  <div className="mt-2">
                    <audio
                      controls
                      className="w-full h-8 transition-opacity opacity-80 hover:opacity-100"
                      onError={() => console.log('Audio error ignored:', mainAudio.url)}
                    >
                      <source src={mainAudio.url} type="audio/mpeg" />
                    </audio>
                  </div>
                )}

                {item.details_url && (
                  <a
                    href={item.details_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono text-amber-500/80 hover:text-amber-400 underline mt-1"
                  >
                    View on Archive.org →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}