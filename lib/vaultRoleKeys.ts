'use client';

// Role-based access keys for the Cosmic Vault, replacing the old single
// PIN ('432'). Same security posture as the PIN it replaces — a
// client-visible shared secret, not a server-verified credential — this
// only gates whether the Vault *view* renders at all. Real enforcement for
// destructive actions (upload/delete/edit) still happens server-side via
// requireAdmin()'s Supabase app_metadata.role check, completely independent
// of these keys. Anyone who has a key (of any role) sees the same read-only
// Vault browsing experience an admin does; only a real Supabase admin
// session can write.
export type VaultRole = 'owner' | 'staff' | 'agent';

const STORAGE_KEY = 'cosmic_vault_role_keys_v1';

const DEFAULT_KEYS: Record<VaultRole, string> = {
  owner: '432-OWNER',
  staff: '432-STAFF',
  agent: '432-AGENT',
};

function readKeys(): Record<VaultRole, string> {
  if (typeof window === 'undefined') return DEFAULT_KEYS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYS;
    const parsed = JSON.parse(raw) as Partial<Record<VaultRole, string>>;
    return {
      owner: parsed.owner || DEFAULT_KEYS.owner,
      staff: parsed.staff || DEFAULT_KEYS.staff,
      agent: parsed.agent || DEFAULT_KEYS.agent,
    };
  } catch {
    return DEFAULT_KEYS;
  }
}

export function getRoleKeys(): Record<VaultRole, string> {
  return readKeys();
}

// Case/whitespace-insensitive match against whichever role key was entered.
export function matchRole(input: string): VaultRole | null {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;
  // Bare '432' — the original shared PIN this role-key system replaced —
  // still works on its own, mapped to 'staff' (standard read access, same
  // as the old PIN gave everyone; write actions stay gated by the separate
  // requireAdmin() check regardless of role).
  if (trimmed === '432') return 'staff';
  const keys = readKeys();
  if (trimmed === keys.owner.toUpperCase()) return 'owner';
  if (trimmed === keys.staff.toUpperCase()) return 'staff';
  if (trimmed === keys.agent.toUpperCase()) return 'agent';
  return null;
}

function randomCode(): string {
  // 8 random base36 chars, uppercased — short enough to read/type back, far
  // less guessable than the 3-digit PIN it replaces.
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36))
    .join('')
    .toUpperCase();
}

export function regenerateRoleKey(role: VaultRole): string {
  const keys = readKeys();
  const next = `${role.toUpperCase()}-${randomCode()}`;
  keys[role] = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  return next;
}
