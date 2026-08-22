import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// Lightweight, purpose-built for the Vault's SUPPORT drawer — separate
// from the main Kali endpoint (app/api/ai-one-chat), which is a cosmology/
// quantum-physics research assistant with tool-use and a knowledge base,
// not a fit for "how do I sign in" questions. No tools, no image support,
// no retrieval — just a focused system prompt plus streaming.
const SYSTEM_PROMPT = `You are the Ai One support assistant, embedded in the Vault's Support drawer. Help users resolve common setup and account questions quickly, in a few sentences.

What you can help with: signing in (magic-link/code email flow), what the Vault is and how role-based access keys work (a key unlocks it; there's no self-service way to get one — direct them to submit a ticket if they need access), Radio Central / Studio One playback issues, and subscription/billing basics (Hobby/Freelancer/Startup/Enterprise tiers, 14-day free trial, monthly or yearly billing).

Be direct and concise — this is a quick-help widget, not a long conversation. If the question is outside what you can actually help with, or you're not confident of the answer, say so plainly and tell them to submit a support ticket instead of guessing. Never invent a feature, price, or policy that isn't listed above.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('Support assistant is not connected yet — no API key configured.', { status: 500 });
  }

  const { messages } = (await request.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('No messages provided.', { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-5',
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages,
        });

        let sentAnyText = false;
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            sentAnyText = true;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        if (!sentAnyText) {
          controller.enqueue(encoder.encode("I didn't generate a usable response — try rephrasing, or submit a support ticket."));
        }
        controller.close();
      } catch (err) {
        console.error('Support assistant stream error:', err);
        controller.error(err);
      }
    },
  });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
