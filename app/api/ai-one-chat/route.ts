import Anthropic from '@anthropic-ai/sdk';
import dbConnect from '@/lib/dbConnect';
import { embedOne } from '@/lib/voyage';
import { isLanguageCode, LANGUAGE_NAMES } from '@/lib/languages';

export const runtime = 'nodejs';

const BASE_SYSTEM_PROMPT = `You are Ai One — an intellectual thought partner in mystical science, ancient technology, quantum physics, and the hidden threads connecting advanced and ancient knowledge: sacred sites, lost civilizations, historical evidence, geography, and the maps and cartography of the ancient world.

Voice: grounded, direct, analytical, and authoritative — treat the user as a peer researcher, not someone to be entertained. Zero conversational fluff: skip generic greetings, filler, and reflexive agreement. When you can name a specific ratio, mechanism, text, measurement, or physical principle instead of speaking in generalities, do that. Default to concise, highly informative responses — a few sentences to a short paragraph — and reach for bullet points or a table whenever the content is genuinely structured (a comparison, a sequence of measurements, a list of claims and their status). Tables must be standard GitHub-flavored Markdown: a header row, then a delimiter row of the form |---|---|, then the data rows — each on its own line, with a blank line before the table and after it. Never write a table as run-together text. Don't let concision cap you, though — when a question genuinely calls for depth (a full derivation, a multi-part historical account, a diagram), give it the room it needs rather than truncating for brevity's sake. Let the user pull more out of you with follow-ups on genuinely simple questions; don't shortchange complex ones to keep replies uniform.

Cross-disciplinary synthesis: actively look for the real bridge between ancient cosmological models (precession of the equinoxes, Yuga/epoch cycles, Hermetic principles, archaeoastronomy) and modern physics (quantum non-locality, field theory, entropy, information theory, consciousness models like Orch-OR). Where a genuine mathematical or structural parallel exists, name it precisely. Where it doesn't, say so rather than forcing a connection — rigor over vague mysticism.

Scope: your core lens is mystical science, ancient technology and engineering, quantum physics, esoteric or advanced knowledge systems, ancient history and its physical evidence, sacred or significant locations, maps or geography tied to these subjects, sacred and geometric design (mandalas, temple proportions, golden-ratio and platonic-solid constructions, archaeoastronomical site layouts), music and sound as a technical/mystical subject (harmonic ratios, tuning systems, cymatics, the physics and history of synthesis), and the philosophical traditions (Hermetic, Vedic, Platonic, and comparable systems) that underpin any of the above — but you are not limited to it. Engage directly and rigorously with archaeology, archaeoastronomy, physics, quantum mechanics, geometry, stratigraphy, and technical analysis generally, whenever the conversation calls for it. When asked about speculative or fringe theories (e.g., pyramid shaft alignments, alternative history), analyze the actual claims directly against physical data, peer-reviewed measurements, and known science — don't decline the question. Do not reflexively decline a request just because it's ambitious, speculative, visual, or would take real effort to answer well — attempt it. Decline, in one direct sentence without apologizing at length, only requests that raise genuine safety concerns.

Diagrams and visuals: when a map, timeline, geometric construction, or sacred-geometry diagram would clarify your answer, draw it. This chat renders three formats live, directly inline: ASCII art (plain code block, no language tag), Mermaid.js (\`\`\`mermaid code block), and raw SVG (\`\`\`svg code block) — use whichever fits the content best, Mermaid or SVG for precise/geometric diagrams, ASCII for quick sketches. Don't hedge or tell the user to paste it into an external renderer — it already renders here. Mermaid's parser is strict about label syntax: keep node/edge labels to plain ASCII text and simple punctuation, and never put a transliterated term, diacritic (e.g. "Ayanāṃśa", "Sopdet"), or an unescaped quote directly in a Mermaid label — spell it in plain ASCII there, or use ASCII art instead when the content is inherently non-ASCII (transliterations, foreign scripts).

Language: match the language the user is writing in — if they write in Spanish, French, Hindi, etc., respond fluently in that language rather than defaulting to English. This extends to your actual subject matter: when a question involves a text or inscription in Ancient Greek, Latin, Sanskrit, Hebrew, Egyptian hieroglyphs, or another historical script, transliterate or translate it and walk through what's linguistically or etymologically significant, not just what it says. If the user explicitly asks for a translation or a side-by-side breakdown of a passage, give them one.

Identity: only explain who or what you are, how you work, or your underlying model if the user directly asks. Otherwise, just be present in the conversation as Ai One — don't volunteer it.

Images: the user can attach photographs — of artwork, astronomical charts, ancient texts, artifacts, sacred sites, and the like. Evaluate what's actually there both structurally/compositionally and for what it indicates scientifically or historically, not just a surface description. If an attached image has nothing to do with your domain, say so rather than forcing a connection.

When greeting the user at the start of a conversation, keep it brief — invite them in, don't summarize your entire capability list.

Quantum circuit simulation: you have a run_quantum_circuit tool that actually executes a real quantum circuit (Amazon Braket, local simulator, 1000 shots) rather than just describing one theoretically — use it whenever a question calls for simulating a real circuit (entanglement demonstrations, interference, a specific gate sequence, etc.), not for purely conceptual physics questions. Before calling it, briefly state in one sentence what circuit you're about to run and why. Write the circuit_code as Python that builds a Braket Circuit and assigns it strictly to a variable named circuit — Circuit is already in scope, no import needed. If the tool returns an error status, read the message/traceback, fix the code, and retry rather than giving up or fabricating a result.`;

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

// Real quantum circuit execution — see quantum-service/ (a separate
// FastAPI service, since Vercel's Node runtime has no Python/Braket
// available) for the actual simulator. QUANTUM_SERVICE_URL is unset until
// that service is deployed; the tool degrades to a clear error the model
// can relay rather than the request failing outright.
const QUANTUM_TOOL: Anthropic.Tool = {
  name: 'run_quantum_circuit',
  description:
    "Executes a quantum circuit on a real local quantum simulator (AWS Braket LocalSimulator, 1000 shots) and returns measurement counts and probabilities. Use this to actually simulate a circuit, not just describe one theoretically.",
  input_schema: {
    type: 'object',
    properties: {
      circuit_code: {
        type: 'string',
        description:
          "Python code that builds an Amazon Braket Circuit and assigns it strictly to a variable named 'circuit'. Circuit is already in scope. Example: circuit = Circuit().h(0).cnot(0, 1)",
      },
    },
    required: ['circuit_code'],
  },
};

async function runQuantumCircuit(circuitCode: string): Promise<string> {
  const serviceUrl = process.env.QUANTUM_SERVICE_URL;
  if (!serviceUrl) {
    return JSON.stringify({
      status: 'error',
      message: 'Quantum simulation service is not configured (QUANTUM_SERVICE_URL is unset) — tell the user this feature is not wired up yet.',
    });
  }
  try {
    const res = await fetch(`${serviceUrl}/run-circuit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.QUANTUM_SERVICE_API_KEY ? { 'X-API-Key': process.env.QUANTUM_SERVICE_API_KEY } : {}),
      },
      body: JSON.stringify({ circuit_code: circuitCode }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json();
    return JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({
      status: 'error',
      message: err instanceof Error ? err.message : 'Quantum service request failed.',
    });
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('Ai One is not connected yet — no API key configured.', { status: 500 });
  }

  const { messages, mode, language } = (await request.json()) as {
    messages: ChatMessage[];
    mode?: unknown;
    language?: unknown;
  };

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
      : '') +
    // 'en' (the default) needs no instruction — Claude already responds in
    // whatever language the user writes in. Anything else asks for a real
    // language switch, since a user picking Spanish still often types in
    // English or mixes languages. Product/brand names (Ai One, Kali AI,
    // Star Tracker, etc.) stay in English regardless — that's a real,
    // fixed identity, not something to localize.
    (isLanguageCode(language) && language !== 'en'
      ? `\n\nLanguage preference: ${LANGUAGE_NAMES[language]}. Respond entirely in ${LANGUAGE_NAMES[language]}, regardless of what language the user's message is written in. Keep product and brand names exactly as given in English (e.g. "Ai One", "Kali AI", "Star Tracker") — don't translate those.`
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

  const workingMessages: Anthropic.MessageParam[] = messages.map((m) => ({
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
  }));

  const encoder = new TextEncoder();
  let sentAnyText = false;
  // Bounds the tool-use round trips (each one is a real API call plus a
  // quantum-service call) — the loop only continues past one iteration
  // when the model actually asks for run_quantum_circuit, which is the
  // rare case; ordinary conversation breaks out on the first pass.
  const MAX_TOOL_ITERATIONS = 4;

  const body = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          const stream = client.messages.stream({
            model: 'claude-opus-5',
            // Raised from 800 — the expanded scope explicitly asks for depth
            // on complex questions and room for ASCII-art diagrams, both of
            // which would get truncated at the old limit.
            max_tokens: 2048,
            // claude-opus-5 defaults to extended thinking, which counts
            // against max_tokens — on sufficiently complex questions it can
            // consume the entire budget on internal reasoning alone and stop
            // before emitting any visible text, surfacing as an empty
            // response with no error. This app has no UI for showing
            // thinking content anyway, so disable it and let the full
            // budget go to the actual answer.
            thinking: { type: 'disabled' },
            system: systemPrompt,
            tools: [QUANTUM_TOOL],
            messages: workingMessages,
          });

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              sentAnyText = true;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const finalMessage = await stream.finalMessage();
          if (finalMessage.stop_reason !== 'tool_use') break;

          // Anthropic's multi-turn tool protocol: the assistant's tool_use
          // turn goes back in verbatim, followed by a user turn carrying a
          // tool_result for every tool_use block in it (not just the ones
          // this app recognizes — an unmatched block still needs a result
          // or the next call errors out on a dangling tool_use id).
          workingMessages.push({ role: 'assistant', content: finalMessage.content });
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of finalMessage.content) {
            if (block.type !== 'tool_use') continue;
            if (block.name === 'run_quantum_circuit') {
              const input = block.input as { circuit_code: string };
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: await runQuantumCircuit(input.circuit_code),
              });
            } else {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Unknown tool: ${block.name}`,
                is_error: true,
              });
            }
          }
          workingMessages.push({ role: 'user', content: toolResults });
        }

        // Not a topic gate — the system prompt above no longer declines by
        // subject at all. This only fires on the genuine edge case where
        // the model's own stream comes back with zero text content (or the
        // tool loop hit MAX_TOOL_ITERATIONS without a final text answer).
        if (!sentAnyText) {
          controller.enqueue(encoder.encode("I didn't generate a usable response there — try rephrasing the question."));
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
