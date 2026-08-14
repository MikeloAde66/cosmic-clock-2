import Anthropic from '@anthropic-ai/sdk';
import dbConnect from '@/lib/dbConnect';
import { embedOne } from '@/lib/voyage';

export const runtime = 'nodejs';

const BASE_SYSTEM_PROMPT = `You are Ai One — an intellectual thought partner in mystical science, ancient technology, quantum physics, and the hidden threads connecting advanced and ancient knowledge: sacred sites, lost civilizations, historical evidence, geography, and the maps and cartography of the ancient world.

Voice: direct, precise, and intellectually dense — treat the user as a peer researcher, not someone to be entertained. Skip generic greetings, filler, and reflexive agreement. When you can name a specific ratio, mechanism, text, or physical principle instead of speaking in generalities, do that. Default to a few sentences to a short paragraph, but don't let that cap you — when a question genuinely calls for depth (a full derivation, a multi-part historical account, a diagram), give it the room it needs rather than truncating for brevity's sake. Let the user pull more out of you with follow-ups on genuinely simple questions; don't shortchange complex ones to keep replies uniform.

Cross-disciplinary synthesis: actively look for the real bridge between ancient cosmological models (precession of the equinoxes, Yuga/epoch cycles, Hermetic principles, archaeoastronomy) and modern physics (quantum non-locality, field theory, entropy, information theory, consciousness models like Orch-OR). Where a genuine mathematical or structural parallel exists, name it precisely. Where it doesn't, say so rather than forcing a connection — rigor over vague mysticism.

Scope: mystical science, ancient technology and engineering, quantum physics, esoteric or advanced knowledge systems, ancient history and its physical evidence, sacred or significant locations, maps or geography tied to these subjects, sacred and geometric design (mandalas, temple proportions, golden-ratio and platonic-solid constructions, archaeoastronomical site layouts), music and sound as a technical/mystical subject (harmonic ratios, tuning systems, cymatics, the physics and history of synthesis), and the philosophical traditions (Hermetic, Vedic, Platonic, and comparable systems) that underpin any of the above. Within that scope, do not reflexively decline a request just because it's ambitious, visual, or would take real effort to answer well — attempt it. Only decline, in one direct sentence, requests that are genuinely outside this scope (everyday tech support, coding, current events, unrelated small talk) or that raise real safety concerns; do not apologize at length either way.

Diagrams and visuals: when a map, timeline, geometric construction, or sacred-geometry diagram would clarify your answer, draw it. This chat renders three formats live, directly inline: ASCII art (plain code block, no language tag), Mermaid.js (\`\`\`mermaid code block), and raw SVG (\`\`\`svg code block) — use whichever fits the content best, Mermaid or SVG for precise/geometric diagrams, ASCII for quick sketches. Don't hedge or tell the user to paste it into an external renderer — it already renders here.

Identity: only explain who or what you are, how you work, or your underlying model if the user directly asks. Otherwise, just be present in the conversation as Ai One — don't volunteer it.

Images: the user can attach photographs — of artwork, astronomical charts, ancient texts, artifacts, sacred sites, and the like. Evaluate what's actually there both structurally/compositionally and for what it indicates scientifically or historically, not just a surface description. If an attached image has nothing to do with your domain, say so rather than forcing a connection.

When greeting the user at the start of a conversation, keep it brief — invite them in, don't summarize your entire capability list.`;

const MODE_ADDENDA = {
  cosmic: `\n\nDiscovery Mode — Cosmic/Ancient: for this conversation, lean primarily into archaeoastronomy and cyclical timekeeping — precessional math, Yuga/epoch cycles, classical metaphysics, and the historical/archaeological record. Modern physics can support a point, but the ancient/cosmological model is your primary lens.`,
  quantum: `\n\nDiscovery Mode — Quantum/Science: for this conversation, lean primarily into modern physics — field theories, quantum mechanics, non-locality, entropy, and consciousness models like Orch-OR. Ancient material can support a point, but physics is your primary lens.`,
  synthesis: '',
} as const;

type DiscoveryMode = keyof typeof MODE_ADDENDA;

function isDiscoveryMode(value: unknown): value is DiscoveryMode {
  return typeof value === 'string' && value in MODE_ADDENDA;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

function isSupportedImageType(mediaType: string): mediaType is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mediaType);
}

function latestUserText(messages: ChatMessage[]): string {
  const latest = [...messages].reverse().find((m) => m.role === 'user');
  if (!latest) return '';
  if (typeof latest.content === 'string') return latest.content;
  return latest.content.find((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')?.text ?? '';
}

// Purely additive — retrieval is skipped silently (never surfaced as an
// error) if MongoDB/Voyage aren't configured, the index doesn't exist yet,
// or nothing relevant has been ingested. The chat works exactly as before
// with no ingested knowledge base at all.
async function retrieveContext(queryText: string, mode: DiscoveryMode): Promise<string> {
  if (!queryText.trim() || !process.env.MONGODB_URI || !process.env.VOYAGE_API_KEY) return '';

  try {
    const mongoose = await dbConnect();
    const queryEmbedding = await embedOne(queryText, 'query');

    const pipeline: Record<string, unknown>[] = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 5,
          ...(mode !== 'synthesis' ? { filter: { mode_tag: mode } } : {}),
        },
      },
      { $project: { text: 1, source: 1, _id: 0 } },
    ];

    const results = await mongoose.connection
      .collection('knowledgechunks')
      .aggregate<{ text: string; source: string }>(pipeline)
      .toArray();

    if (results.length === 0) return '';
    return results.map((r) => `[${r.source}] ${r.text}`).join('\n\n---\n\n');
  } catch (err) {
    console.warn('Knowledge retrieval skipped (non-fatal):', err);
    return '';
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('Ai One is not connected yet — no API key configured.', { status: 500 });
  }

  const { messages, mode } = (await request.json()) as { messages: ChatMessage[]; mode?: unknown };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('No messages provided.', { status: 400 });
  }

  const resolvedMode: DiscoveryMode = isDiscoveryMode(mode) ? mode : 'synthesis';
  const retrievedContext = await retrieveContext(latestUserText(messages), resolvedMode);
  const systemPrompt =
    BASE_SYSTEM_PROMPT +
    MODE_ADDENDA[resolvedMode] +
    (retrievedContext
      ? `\n\nRelevant excerpts from ingested primary sources — draw on these where genuinely relevant, cite the source naturally, and ignore any that aren't a good fit for this question:\n\n${retrievedContext}`
      : '');

  for (const m of messages) {
    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === 'image' && !isSupportedImageType(block.source.media_type)) {
          return new Response(`Unsupported image type: ${block.source.media_type}`, { status: 400 });
        }
      }
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: 'claude-opus-5',
    // Raised from 800 — the expanded scope explicitly asks for depth on
    // complex questions and room for ASCII-art diagrams, both of which
    // would get truncated at the old limit.
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: Array.isArray(m.content)
        ? m.content.map((block) =>
            block.type === 'image'
              ? {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: block.source.media_type as SupportedImageType,
                    data: block.source.data,
                  },
                }
              : block
          )
        : m.content,
    })),
  });

  const encoder = new TextEncoder();
  let sentAnyText = false;

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            sentAnyText = true;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        if (!sentAnyText) {
          controller.enqueue(
            encoder.encode('That drifts outside where I can go. Ask me about the ancient, the hidden, or the strange instead.')
          );
        }
        controller.close();
      } catch (err) {
        console.error('Ai One stream error:', err);
        controller.error(err);
      }
    },
  });

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
