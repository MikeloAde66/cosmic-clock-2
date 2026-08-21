'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Pencil, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, RADIO_STATIONS } from '@/lib/radioStations';

const CURATABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'ALL CHANNELS');

interface AdminStation {
  id: string;
  name: string;
  network: string;
  tagline: string;
  genre: string;
  category: string;
  streamUrl: string;
  badge: string;
  badgeColor: string;
}

interface FormState {
  name: string;
  network: string;
  tagline: string;
  genre: string;
  category: string;
  streamUrl: string;
  badge: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  network: '',
  tagline: '',
  genre: '',
  category: CURATABLE_CATEGORIES[0],
  streamUrl: '',
  badge: '',
};

// Dedicated full view (Back arrow, no overlay) for Program Manager curation
// of Radio Central's live stream endpoints — additive to the hand-picked
// RADIO_STATIONS list, which is shown below read-only for context. Gated
// by the same requireAdmin check every other admin-only Vault action uses
// (lib/adminAuth.ts) — no separate "Program Manager" role was invented for
// this first slice.
export default function RadioStationsAdminPage() {
  const [authState, setAuthState] = useState<'checking' | 'admin' | 'denied'>('checking');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthState(data.user?.app_metadata?.role === 'admin' ? 'admin' : 'denied');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthState(session?.user?.app_metadata?.role === 'admin' ? 'admin' : 'denied');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const getAuthHeader = async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const [stations, setStations] = useState<AdminStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStations = () => {
    setIsLoading(true);
    fetch('/api/admin/radio-stations')
      .then((res) => res.json())
      .then((data) => setStations(Array.isArray(data.stations) ? data.stations : []))
      .catch(() => setError('Failed to load stations.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (authState === 'admin') loadStations();
  }, [authState]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const startEdit = (s: AdminStation) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      network: s.network,
      tagline: s.tagline,
      genre: s.genre,
      category: s.category,
      streamUrl: s.streamUrl,
      badge: s.badge,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.streamUrl.trim()) {
      setFormError('Name and stream URL are required.');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/admin/radio-stations', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      if (!res.ok) {
        setFormError(await res.text());
        return;
      }
      setShowForm(false);
      loadStations();
    } catch {
      setFormError('Save failed — check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/admin/radio-stations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setStations((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (authState === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-500 font-mono text-xs">
        Checking access…
      </div>
    );
  }

  if (authState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-slate-950 text-white font-mono">
        <p className="text-sm text-slate-300">Sign in with an admin account to manage Radio Central stations.</p>
        <Link href="/" className="text-xs text-slate-500 hover:text-white underline">
          Back to Ai One
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <h1 className="text-sm font-mono font-bold tracking-widest uppercase">Radio Central — Station Curation</h1>
        </div>

        <p className="text-xs text-slate-500 font-mono">
          Program Manager access — add, edit, or remove live stream endpoints. Stations added here appear in Radio
          Central for every visitor immediately, no deploy needed.
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400">Curated Stations</h2>
          <button
            onClick={startCreate}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded bg-white text-black hover:bg-neutral-200 transition"
          >
            <Plus className="w-3 h-3" />
            Add Station
          </button>
        </div>

        {error && <p className="text-xs font-mono text-red-400">{error}</p>}
        {isLoading && <p className="text-xs font-mono text-slate-600">Loading…</p>}

        {!isLoading && stations.length === 0 && (
          <p className="text-xs font-mono text-slate-600">No admin-curated stations yet — add one above.</p>
        )}

        <div className="space-y-2">
          {stations.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 p-3 border rounded-lg border-slate-800 bg-slate-900/40"
            >
              <div
                className="flex items-center justify-center w-9 h-9 text-[10px] font-mono font-black tracking-wider text-white rounded shrink-0"
                style={{ backgroundColor: s.badgeColor }}
              >
                {s.badge}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate">{s.name}</h3>
                <p className="text-xs truncate text-slate-500">
                  {s.category} · {s.streamUrl}
                </p>
              </div>
              <button
                onClick={() => startEdit(s)}
                className="p-2 text-slate-500 hover:text-white transition"
                aria-label={`Edit ${s.name}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deletingId === s.id}
                className="p-2 text-slate-500 hover:text-red-400 transition disabled:opacity-40"
                aria-label={`Delete ${s.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800">
          <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-slate-600">
            Seeded Stations (read-only)
          </h2>
          <p className="mt-1 text-[11px] font-mono text-slate-600">
            Hand-picked in code — including the 432Hz Vault stream, which stays untouched by this page by design.
          </p>
          <div className="mt-3 space-y-1.5">
            {RADIO_STATIONS.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 border rounded-lg border-slate-900 bg-slate-900/20">
                <div
                  className="flex items-center justify-center w-7 h-7 text-[9px] font-mono font-black tracking-wider text-white rounded shrink-0"
                  style={{ backgroundColor: s.badgeColor }}
                >
                  {s.badge}
                </div>
                <span className="text-xs truncate text-slate-400">{s.name}</span>
                <span className="text-[10px] font-mono text-slate-700 ml-auto">{s.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-md p-6 space-y-3 border rounded-xl bg-slate-950 border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{editingId ? 'Edit Station' : 'Add Station'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close" className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Station name"
              className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
            />
            <input
              type="text"
              value={form.streamUrl}
              onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
              placeholder="Stream URL (https://...)"
              className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
            >
              {CURATABLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={form.network}
                onChange={(e) => setForm({ ...form, network: e.target.value })}
                placeholder="Network (optional)"
                className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
              />
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="Badge text (e.g. NEW)"
                maxLength={4}
                className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
              />
            </div>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Tagline (optional)"
              className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
            />
            <input
              type="text"
              value={form.genre}
              onChange={(e) => setForm({ ...form, genre: e.target.value })}
              placeholder="Genre (optional)"
              className="w-full p-2.5 font-mono text-sm border rounded-lg bg-slate-900 border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
            />

            {formError && <p className="text-xs font-mono text-red-400">{formError}</p>}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-40 transition"
            >
              {isSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Station'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
