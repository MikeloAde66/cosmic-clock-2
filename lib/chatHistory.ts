// Per-browser chat thread persistence for AiOneChat — localStorage, no
// account/backend involved. Threads are capped and images are stripped
// before storage (see stripImagesForStorage) since localStorage has a
// realistic ~5-10MB quota and this app already accepts up to 5MB per
// attached image; keeping base64 image data around across many saved
// threads would blow through that fast.

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export type DiscoveryMode = 'cosmic' | 'quantum' | 'synthesis';

export interface ChatThread {
  id: string;
  title: string;
  mode: DiscoveryMode;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'cosmic_ai_one_threads_v1';
const MAX_THREADS = 30;
const TITLE_MAX_LENGTH = 48;

export function messageText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  const textBlock = content.find((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text');
  return textBlock?.text ?? '';
}

// Drops base64 image data (see module comment) — keeps a plain-text marker
// so the thread still reads sensibly when reloaded from History.
function stripImagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const hasImage = m.content.some((b) => b.type === 'image');
    if (!hasImage) return m;
    const text = messageText(m.content);
    return { ...m, content: text ? `${text}\n\n[image attached — not saved]` : '[image attached — not saved]' };
  });
}

export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = firstUser ? messageText(firstUser.content).trim() : '';
  if (!text) return 'Untitled conversation';
  return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : text;
}

function readAll(): ChatThread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(threads: ChatThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch (err) {
    console.warn('Failed to persist chat history (localStorage full or unavailable):', err);
  }
}

export function listThreads(): ChatThread[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadThread(id: string): ChatThread | null {
  return readAll().find((t) => t.id === id) ?? null;
}

// Upserts by id, keeps only the most recent MAX_THREADS, and always strips
// images before writing — the one place all three storage rules apply.
export function saveThread(thread: Omit<ChatThread, 'updatedAt'>) {
  const threads = readAll();
  const idx = threads.findIndex((t) => t.id === thread.id);
  const next: ChatThread = {
    ...thread,
    messages: stripImagesForStorage(thread.messages),
    updatedAt: Date.now(),
  };
  if (idx === -1) threads.push(next);
  else threads[idx] = next;

  threads.sort((a, b) => b.updatedAt - a.updatedAt);
  writeAll(threads.slice(0, MAX_THREADS));
}

export function deleteThread(id: string) {
  writeAll(readAll().filter((t) => t.id !== id));
}

export function createThreadId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface ExtractedDiagram {
  key: string;
  threadId: string;
  threadTitle: string;
  lang: 'mermaid' | 'svg';
  code: string;
}

const FENCE_RE = /```(mermaid|svg)\r?\n([\s\S]*?)```/g;

// Pulls every mermaid/svg fenced code block out of a set of threads' assistant
// messages — a plain regex scan rather than a full markdown parse, since all
// that's needed here is the fenced blocks themselves, not full AST fidelity.
export function extractDiagramsFromThreads(threads: ChatThread[]): ExtractedDiagram[] {
  const results: ExtractedDiagram[] = [];
  for (const thread of threads) {
    thread.messages.forEach((m, messageIndex) => {
      if (m.role !== 'assistant') return;
      const text = messageText(m.content);
      let diagramIndex = 0;
      FENCE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = FENCE_RE.exec(text))) {
        results.push({
          key: `${thread.id}-${messageIndex}-${diagramIndex++}`,
          threadId: thread.id,
          threadTitle: thread.title,
          lang: match[1] as 'mermaid' | 'svg',
          code: match[2].trim(),
        });
      }
    });
  }
  return results;
}
