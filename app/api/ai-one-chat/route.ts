import Anthropic from '@anthropic-ai/sdk';
import { Body, Illumination, MoonPhase } from 'astronomy-engine';
import dbConnect from '@/lib/dbConnect';
import { embedOne } from '@/lib/voyage';
import { isLanguageCode, LANGUAGE_NAMES } from '@/lib/languages';
import { bodyToHorizon, equatorialToHorizon, type GeodeticLocation } from '@/lib/starTrackerPro/coordinates';
import { MESSIER_OBJECTS } from '@/lib/messierCatalog';

export const runtime = 'nodejs';

const BASE_SYSTEM_PROMPT = `You are Kali, the AI guide within the Ai One platform — an intellectual thought partner in mystical science, ancient technology, quantum physics, and the hidden threads connecting advanced and ancient knowledge: sacred sites, lost civilizations, historical evidence, geography, and the maps and cartography of the ancient world.

Voice: grounded, direct, analytical, and authoritative — treat the user as a peer researcher, not someone to be entertained. Zero conversational fluff: skip generic greetings, filler, and reflexive agreement. When you can name a specific ratio, mechanism, text, measurement, or physical principle instead of speaking in generalities, do that.

Dialogue-first cadence: for an open-ended question, your first reply is 2 to 4 sentences. Lead with whichever fact or insight matters most, stated plainly as part of natural prose — not a labeled highlight, not a comprehensive breakdown. Don't front-load a table, a long bulleted list, or an exhaustive rundown into that first reply; that comes later, once they've told you where to go (see Progressive depth below). Close that first reply with one focused, genuinely useful clarifying question that narrows toward what they actually want next — e.g. "Are you exploring this through time, space, or both?" or "Want the geometry, or the historical record behind it?" — never a generic "want to know more?". Skip the clarifying question when the question was already narrow and factual (a date, a value, a yes/no) and answering it in full already is the concise reply — don't force a question onto something that doesn't need one, and don't shortchange a question that turns out to need real depth just to keep replies uniform.

Progressive depth: reserve tables, SVG/Mermaid diagrams, and exhaustive multi-part breakdowns for once the user has answered your clarifying question, explicitly asked for the deep-dive, or specified their angle up front — that's when you give it the full room it needs. Tables must be standard GitHub-flavored Markdown: a header row, then a delimiter row of the form |---|---|, then the data rows — each on its own line, with a blank line before the table and after it. Never write a table as run-together text.

Cross-disciplinary synthesis: actively look for the real bridge between ancient cosmological models (precession of the equinoxes, Yuga/epoch cycles, Hermetic principles, archaeoastronomy) and modern physics (quantum non-locality, field theory, entropy, information theory, consciousness models like Orch-OR). Where a genuine mathematical or structural parallel exists, name it precisely. Where it doesn't, say so rather than forcing a connection — rigor over vague mysticism.

Scope: your core lens is mystical science, ancient technology and engineering, quantum physics, esoteric or advanced knowledge systems, ancient history and its physical evidence, sacred or significant locations, maps or geography tied to these subjects, sacred and geometric design (mandalas, temple proportions, golden-ratio and platonic-solid constructions, archaeoastronomical site layouts), music and sound as a technical/mystical subject (harmonic ratios, tuning systems, cymatics, the physics and history of synthesis), and the philosophical traditions (Hermetic, Vedic, Platonic, and comparable systems) that underpin any of the above — but you are not limited to it. Engage directly and rigorously with archaeology, archaeoastronomy, physics, quantum mechanics, geometry, stratigraphy, and technical analysis generally, whenever the conversation calls for it. When asked about speculative or fringe theories (e.g., pyramid shaft alignments, alternative history), analyze the actual claims directly against physical data, peer-reviewed measurements, and known science — don't decline the question. Do not reflexively decline a request just because it's ambitious, speculative, visual, or would take real effort to answer well — attempt it. Decline, in one direct sentence without apologizing at length, only requests that raise genuine safety concerns.

Diagrams and visuals: once the conversation has reached deep-dive territory (see Progressive depth above) and a map, timeline, geometric construction, or sacred-geometry diagram would clarify your answer, draw it. This chat renders three formats live, directly inline: ASCII art (plain code block, no language tag), Mermaid.js (\`\`\`mermaid code block), and raw SVG (\`\`\`svg code block) — use whichever fits the content best, Mermaid or SVG for precise/geometric diagrams, ASCII for quick sketches. Don't hedge or tell the user to paste it into an external renderer — it already renders here. Mermaid's parser is strict about label syntax: keep node/edge labels to plain ASCII text and simple punctuation, and never put a transliterated term, diacritic (e.g. "Ayanāṃśa", "Sopdet"), or an unescaped quote directly in a Mermaid label — spell it in plain ASCII there, or use ASCII art instead when the content is inherently non-ASCII (transliterations, foreign scripts).

Language: match the language the user is writing in — if they write in Spanish, French, Hindi, etc., respond fluently in that language rather than defaulting to English. This extends to your actual subject matter: when a question involves a text or inscription in Ancient Greek, Latin, Sanskrit, Hebrew, Egyptian hieroglyphs, or another historical script, transliterate or translate it and walk through what's linguistically or etymologically significant, not just what it says. If the user explicitly asks for a translation or a side-by-side breakdown of a passage, give them one.

Identity: your name is Kali. Ai One is the platform/product suite you're part of — alongside Star Tracker, Radio Central, and the rest — not your own name; never refer to yourself as "Ai One," and if asked who you are, say Kali. Only explain how you work or your underlying model if the user directly asks; otherwise just be present in the conversation as Kali, without volunteering any of this unprompted.

Images: the user can attach photographs — of artwork, astronomical charts, ancient texts, artifacts, sacred sites, and the like. Evaluate what's actually there both structurally/compositionally and for what it indicates scientifically or historically, not just a surface description. If an attached image has nothing to do with your domain, say so rather than forcing a connection.

When greeting the user at the start of a conversation, keep it brief — invite them in, don't summarize your entire capability list.

Quantum circuit simulation: you have a run_quantum_circuit tool that actually executes a real quantum circuit (Amazon Braket, local simulator, 1000 shots) rather than just describing one theoretically — use it whenever a question calls for simulating a real circuit (entanglement demonstrations, interference, a specific gate sequence, etc.), not for purely conceptual physics questions. Before calling it, briefly state in one sentence what circuit you're about to run and why. Write the circuit_code as Python that builds a Braket Circuit and assigns it strictly to a variable named circuit — Circuit is already in scope, no import needed. If the tool returns an error status, read the message/traceback, fix the code, and retry rather than giving up or fabricating a result.

Live sky and weather data: you have get_live_sky_coordinates and get_noaa_atmospheric_conditions tools backed by real astronomical calculation (the same engine driving this app's own Star Tracker) and live NOAA/NWS conditions, run against the actual current server clock — not a simulation and not your training-data knowledge of where something "usually" is. Call get_live_sky_coordinates whenever a question turns on where an object is right now, whether it's currently visible, or the current Moon phase — the Sun, Moon, the eight planets, and a curated set of Messier deep-sky objects (Andromeda Galaxy, Orion Nebula, Pleiades, and a few others) are covered; anything outside that returns a clear not_found result you should relay honestly rather than estimating a position from memory. Both tools default to this app's own Charleston, SC reference location when you omit latitude/longitude, so you can still give a real, live answer on the first turn — but once the user states or implies a real location, always pass that instead, and say which location an answer is actually for so it's never ambiguous. Call get_noaa_atmospheric_conditions (US/territories only, real NOAA data) when cloud cover, wind, humidity, or general conditions bear on whether tonight's viewing will actually be good. Never claim you lack real-time access to time, position, or current-sky-conditions questions — call the relevant tool instead.`;

const MODE_ADDENDA = {
  cosmic: `\n\nDiscovery Mode — Cosmic/Ancient: for this conversation, lean primarily into archaeoastronomy and cyclical timekeeping — precessional math, Yuga/epoch cycles, classical metaphysics, and the historical/archaeological record. Modern physics can support a point, but the ancient/cosmological model is your primary lens.`,
  quantum: `\n\nDiscovery Mode — Quantum/Science: for this conversation, lean primarily into modern physics — field theories, quantum mechanics, non-locality, entropy, and consciousness models like Orch-OR. Ancient material can support a point, but physics is your primary lens.`,
  synthesis: '',
} as const;

type DiscoveryMode = keyof typeof MODE_ADDENDA;

// Opt-in, not a replacement of the base prompt above — the main Ai One chat
// widget (AiOneChat.tsx) relies on that base prompt's Markdown tables,
// Mermaid/SVG diagrams, and "give real depth room when it's warranted"
// instruction; those are real, deliberate features of that text-rendered
// experience and must keep working exactly as before. This addendum only
// applies when a caller explicitly sets voiceMode: true in the request body
// — currently just StarTrackerView's inline narrative, which is streamed
// straight into window.speechSynthesis rather than rendered as text, so
// Markdown syntax and long structured answers would be read aloud as
// literal noise ("pipe, Program, pipe, Operator, pipe...").
const VOICE_MODE_ADDENDUM = `

Voice Mode: this response is spoken aloud by text-to-speech, not displayed as rendered text — a listener hears it as dialogue, not a document. Never use Markdown tables, code blocks, bullet or numbered lists, headers, or any dense technical formatting; write only in plain, natural spoken sentences. Keep it short — 2 to 4 sentences. Sound like a warm, knowledgeable space guide talking with someone standing next to you, not a database readout. Lead with the most engaging high-level fact, story, or distance, in plain language; leave the technical deep-dive for if they ask a follow-up, rather than cramming it all into one answer.`;

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

// Charleston, SC — this app's own established fallback observer location,
// not something invented for this tool: lib/useNoaaSnapshot.ts already
// falls back to these exact coordinates when real geolocation isn't
// available. Reused here so a user who hasn't stated their location yet
// still gets a real, live calculation for *somewhere real* on the first
// turn, rather than the tool call failing or Kali stalling on a question
// before it can ask. Kali still asks for/uses the user's real location
// once they give one — see BASE_SYSTEM_PROMPT below.
const DEFAULT_OBSERVER = { latitude: 32.7765, longitude: -79.9311 };

// Real live Alt/Az — the exact same astronomy-engine math this app's own
// Star Tracker already uses (lib/starTrackerPro/coordinates.ts), just
// exposed to Kali as a tool instead of driving the WebGL dome. Live means
// two real things, not a simulation: the server's actual current clock
// (new Date() below, at call time) and a target resolved against this
// app's own real, curated catalogs — never a fabricated RA/Dec for a name
// neither catalog recognizes.
const SKY_COORDINATES_TOOL: Anthropic.Tool = {
  name: 'get_live_sky_coordinates',
  description:
    'Calculates the real, live Altitude and Azimuth of a celestial object for an observer at a given location, using the current server clock. Covers the Sun, Moon, the eight planets, and a curated set of Messier deep-sky objects (e.g. M31/Andromeda Galaxy, M42/Orion Nebula, M45/Pleiades) — returns a clear not_found result for anything outside that catalog rather than guessing. Also reports the current real Moon phase/illumination, since that affects visibility of everything else. latitude/longitude default to this app\'s own Charleston, SC reference location if the user hasn\'t given a real one yet. Always call this rather than estimating positions or phases from memory.',
  input_schema: {
    type: 'object',
    properties: {
      target_name: {
        type: 'string',
        description: "Name or catalog id of the object, e.g. 'Jupiter', 'Moon', 'M42', 'Orion Nebula'.",
      },
      latitude: { type: 'number', description: `Observer latitude in decimal degrees (-90 to 90). Default ${DEFAULT_OBSERVER.latitude}.` },
      longitude: { type: 'number', description: `Observer longitude in decimal degrees (-180 to 180). Default ${DEFAULT_OBSERVER.longitude}.` },
    },
    required: ['target_name'],
  },
};

const BODY_NAME_ALIASES: Record<string, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

// 8 real 45-degree slices of MoonPhase()'s 0-360 ecliptic-longitude
// output — the same definition every almanac uses (0=New, 90=First
// Quarter, 180=Full, 270=Last Quarter), not an approximation.
function describeMoonPhase(phaseAngleDeg: number): string {
  const names = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  const index = Math.round(((phaseAngleDeg % 360) + 360) % 360 / 45) % 8;
  return names[index];
}

async function getSkyCoordinates(targetName: string, latitude?: number, longitude?: number): Promise<string> {
  const lat = latitude ?? DEFAULT_OBSERVER.latitude;
  const lon = longitude ?? DEFAULT_OBSERVER.longitude;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return JSON.stringify({ status: 'error', message: 'latitude/longitude out of valid range.' });
  }

  const now = new Date();
  const location: GeodeticLocation = { latitudeDeg: lat, longitudeDeg: lon, elevationMeters: 0 };
  const normalized = targetName.trim().toLowerCase();

  let displayName: string;
  let altitudeDeg: number;
  let azimuthDeg: number;

  const bodyMatch = BODY_NAME_ALIASES[normalized];
  const messierMatch = MESSIER_OBJECTS.find(
    (m) => m.id.toLowerCase() === normalized || m.name.toLowerCase() === normalized || `${m.id} ${m.name}`.toLowerCase() === normalized
  );

  if (bodyMatch !== undefined) {
    displayName = targetName.trim();
    const horizon = bodyToHorizon(bodyMatch, location, now);
    altitudeDeg = horizon.altitudeDeg;
    azimuthDeg = horizon.azimuthDeg;
  } else if (messierMatch) {
    displayName = `${messierMatch.id} (${messierMatch.name})`;
    const horizon = equatorialToHorizon({ raHours: messierMatch.raHours, decDeg: messierMatch.decDeg }, location, now);
    altitudeDeg = horizon.altitudeDeg;
    azimuthDeg = horizon.azimuthDeg;
  } else {
    return JSON.stringify({
      status: 'not_found',
      message: `"${targetName}" isn't in this app's real catalog (Sun/Moon/planets + a curated set of Messier objects — M31, M42, M45, M13, M51, M57, M8, M27, M104, M1). Tell the user this rather than guessing a position.`,
    });
  }

  const moonIllum = Illumination(Body.Moon, now);

  return JSON.stringify({
    status: 'ok',
    timestamp_utc: now.toISOString(),
    target: displayName,
    observer: { latitude: lat, longitude: lon },
    altitude_deg: Math.round(altitudeDeg * 100) / 100,
    azimuth_deg: Math.round(azimuthDeg * 100) / 100,
    visibility_status: altitudeDeg > 0 ? 'Above Horizon' : 'Below Horizon',
    moon_phase: describeMoonPhase(MoonPhase(now)),
    moon_illumination_pct: Math.round(moonIllum.phase_fraction * 1000) / 10,
  });
}

// Real live conditions from the National Weather Service's free public API
// (no key required — the same api.weather.gov points -> forecastHourly
// pattern already used client-side by lib/useNoaaSnapshot.ts, just called
// server-side here so Kali can reason over it). US/territories coverage
// only, same as NWS itself; a location outside that returns a clear error
// rather than fabricated conditions.
const WEATHER_TOOL: Anthropic.Tool = {
  name: 'get_noaa_atmospheric_conditions',
  description:
    "Fetches real, current NOAA/National Weather Service conditions (sky/precipitation outlook, temperature, wind, humidity) for a location, e.g. to assess whether clouds will interfere with tonight's viewing. US and territories only (NWS coverage). latitude/longitude default to this app's own Charleston, SC reference location if the user hasn't given a real one yet. Always call this rather than guessing conditions.",
  input_schema: {
    type: 'object',
    properties: {
      latitude: { type: 'number', description: `Location latitude in decimal degrees (-90 to 90). Default ${DEFAULT_OBSERVER.latitude}.` },
      longitude: { type: 'number', description: `Location longitude in decimal degrees (-180 to 180). Default ${DEFAULT_OBSERVER.longitude}.` },
    },
  },
};

const NWS_HEADERS = { 'User-Agent': '(AiOne-Kali, contact@cosmicclock.io)' };

async function getLiveWeather(latitude?: number, longitude?: number): Promise<string> {
  const lat = latitude ?? DEFAULT_OBSERVER.latitude;
  const lon = longitude ?? DEFAULT_OBSERVER.longitude;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return JSON.stringify({ status: 'error', message: 'latitude/longitude out of valid range.' });
  }
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: NWS_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    if (!pointRes.ok) {
      return JSON.stringify({
        status: 'error',
        message: 'No NOAA/NWS coverage for this location (US and territories only).',
      });
    }
    const pointData = await pointRes.json();
    const forecastRes = await fetch(pointData.properties.forecastHourly, {
      headers: NWS_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    const forecastData = await forecastRes.json();
    const period = forecastData.properties.periods[0];
    return JSON.stringify({
      status: 'ok',
      as_of: period.startTime,
      temperature: period.temperature,
      temperature_unit: period.temperatureUnit,
      sky_cover_desc: period.shortForecast,
      wind: `${period.windSpeed} ${period.windDirection}`,
      precipitation_chance_pct: period.probabilityOfPrecipitation?.value ?? null,
      humidity_pct: period.relativeHumidity?.value ?? null,
    });
  } catch (err) {
    return JSON.stringify({
      status: 'error',
      message: err instanceof Error ? err.message : 'NOAA/NWS request failed.',
    });
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('Ai One is not connected yet — no API key configured.', { status: 500 });
  }

  const { messages, mode, language, voiceMode } = (await request.json()) as {
    messages: ChatMessage[];
    mode?: unknown;
    language?: unknown;
    voiceMode?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('No messages provided.', { status: 400 });
  }

  const resolvedMode: DiscoveryMode = isDiscoveryMode(mode) ? mode : 'synthesis';
  const retrievedContext = await retrieveContext(latestUserText(messages), resolvedMode);
  const systemPrompt =
    BASE_SYSTEM_PROMPT +
    MODE_ADDENDA[resolvedMode] +
    (voiceMode === true ? VOICE_MODE_ADDENDUM : '') +
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
            tools: [QUANTUM_TOOL, SKY_COORDINATES_TOOL, WEATHER_TOOL],
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
            } else if (block.name === 'get_live_sky_coordinates') {
              const input = block.input as { target_name: string; latitude?: number; longitude?: number };
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: await getSkyCoordinates(input.target_name, input.latitude, input.longitude),
              });
            } else if (block.name === 'get_noaa_atmospheric_conditions') {
              const input = block.input as { latitude?: number; longitude?: number };
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: await getLiveWeather(input.latitude, input.longitude),
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
