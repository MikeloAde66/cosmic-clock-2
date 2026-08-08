const TARGET_CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

// Paragraph-first chunking: groups paragraphs up to the target size, falling
// back to a fixed-size sliding window (with overlap) for any single
// paragraph that's already longer than the target on its own.
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > TARGET_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < paragraph.length; i += TARGET_CHUNK_CHARS - OVERLAP_CHARS) {
        chunks.push(paragraph.slice(i, i + TARGET_CHUNK_CHARS));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > TARGET_CHUNK_CHARS) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
