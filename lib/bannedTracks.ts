// Explicit denylist for tracks/stations that must never enter Radio
// Central's rotation, regardless of which backend still happens to serve
// them (Vault/MongoDB tracks, admin-curated stations, or the external
// Media Flow catalog service) — a defensive filter applied at every real
// queue-building choke point, not a substitute for deleting the
// underlying record wherever it actually lives (this repo has no
// credentials to reach the Vault MongoDB or the Media Flow catalog
// service directly).
const BANNED_TITLE_SUBSTRINGS = ['x minus one', 'no contact', 'off grid, and diy', 'living off grid'];

export function isBannedTrackTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const normalized = title.toLowerCase();
  return BANNED_TITLE_SUBSTRINGS.some((banned) => normalized.includes(banned));
}
