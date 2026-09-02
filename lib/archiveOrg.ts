// Shared by components/MediaFlowAudioCenter.tsx (Internet Archive catalog
// import) and components/PodsModule.tsx (Studio One's Internet Archive
// embed support) — kept in one place so the identifier-parsing regex
// doesn't drift between the two call sites.

export function extractIdentifier(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/[/:]/.test(trimmed)) return trimmed; // a bare item id, e.g. "rosen"
  const match = trimmed.match(/archive\.org\/(?:details|download)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

export function buildArchiveEmbedUrl(identifier: string): string {
  return `https://archive.org/embed/${encodeURIComponent(identifier)}`;
}
