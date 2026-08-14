'use client';

// Admin-authored per-product additions layered on top of the static demo
// catalog in lib/products.ts — a Canva reel link and an in-stock toggle.
// This is deliberately NOT a full metadata editor: renaming/re-pricing a
// product means editing real source code (lib/products.ts), not faking a
// "live edit" over hardcoded data. Persisted to localStorage only — a real,
// working per-browser store, same pattern as lib/spaceMediaPlaylist.ts, but
// not a shared database; an admin's Canva link/stock toggle on one device
// won't appear on another until lib/products.ts itself is updated.
export interface ProductOverride {
  reelUrl?: string;
  isAvailable?: boolean;
}

const STORAGE_KEY = 'cosmic_product_overrides_v1';

function readAll(): Record<string, ProductOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProductOverride>) : {};
  } catch {
    return {};
  }
}

function writeAll(overrides: Record<string, ProductOverride>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getOverride(productId: string): ProductOverride | undefined {
  return readAll()[productId];
}

export function saveOverride(productId: string, patch: Partial<ProductOverride>): ProductOverride {
  const all = readAll();
  const next = { ...all[productId], ...patch };
  all[productId] = next;
  writeAll(all);
  return next;
}
