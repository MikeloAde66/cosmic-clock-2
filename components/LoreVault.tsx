'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
interface LoreItem {
  id: number;
  title: string;
  content: string;
  tags?: string;
}

export default function LoreVault() {
  const [items, setItems] = useState<LoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLore() {
      setLoading(true);
      const { data, error } = await supabase
        .from('lore_vault')
        .select('*');

      if (error) {
        console.error('Error fetching lore:', error);
      } else {
        setItems(data || []);
      }
      setLoading(false);
    }

    fetchLore();
  }, []);

  return (
    <div className="relative z-10 max-w-5xl p-8 mx-auto">
      <h1 className="mb-6 text-3xl font-bold tracking-wider text-amber-400">
        COSMIC LORE VAULT
      </h1>

      {loading && (
        <p className="text-gray-400 animate-pulse">Scanning the vault...</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-gray-500">No records found in the vault.</p>
      )}

      <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-6 transition-all border shadow-lg rounded-xl bg-black/60 border-amber-500/30 backdrop-blur-md hover:border-amber-400/60"
          >
            <h2 className="mb-2 text-xl font-semibold text-amber-200">
              {item.title}
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-300">
              {item.content}
            </p>
            {item.tags && (
              <span className="inline-block px-2.5 py-1 text-xs font-mono rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                #{item.tags}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}