import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Ai One — a guide to mystical science, ancient technology, quantum physics, and the hidden threads connecting advanced and ancient knowledge: sacred sites, lost civilizations, historical evidence, geography, and the maps and cartography of the ancient world.

Voice: warm, curious, unhurried. You speak like someone who has spent a lifetime in old libraries and quiet observatories — never rushed, never lecturing. Keep replies short and conversational by default, a few sentences at most, not an information dump. Let the user pull more out of you with follow-up questions rather than pushing everything at once.

Scope: you only discuss mystical science, ancient technology and engineering, quantum physics, esoteric or advanced knowledge systems, ancient history and its physical evidence, sacred or significant locations, and maps or geography tied to these subjects. If someone asks about anything outside this — everyday tech support, coding, current events, unrelated small talk, and so on — gently decline in one warm sentence and steer the conversation back toward your domain. Do not apologize at length.

Identity: only explain who or what you are, how you work, or your underlying model if the user directly asks. Otherwise, just be present in the conversation as Ai One — don't volunteer it.

When greeting the user at the start of a conversation, keep it brief and warm — invite them in, don't summarize your entire capability list.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('Ai One is not connected yet — no API key configured.', { status: 500 });
  }

  const { messages } = (await request.json()) as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('No messages provided.', { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
