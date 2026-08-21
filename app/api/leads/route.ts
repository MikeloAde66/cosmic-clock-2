// Forwards real sign-up events to an n8n workflow — CRM sync, onboarding
// email, whatever the workflow does on its end. Forwarding is conditional
// on N8N_LEAD_WEBHOOK_URL: unset today (no real n8n instance wired up yet),
// so this endpoint currently just logs the lead server-side and returns
// success. The moment that env var is set to a real n8n webhook URL,
// forwarding activates with no code change needed.
export const runtime = 'nodejs';

interface LeadPayload {
  email: string;
  source: string;
  address?: string;
  preferences?: string;
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (!isValidEmail(body.email) || typeof body.source !== 'string' || !body.source.trim()) {
    return new Response('email and source are required; email must be a valid address.', { status: 400 });
  }

  const lead: LeadPayload = {
    email: body.email,
    source: body.source,
    address: typeof body.address === 'string' ? body.address : undefined,
    preferences: typeof body.preferences === 'string' ? body.preferences : undefined,
  };

  console.log('Lead captured:', { email: lead.email, source: lead.source });

  const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, capturedAt: new Date().toISOString() }),
      });
    } catch (err) {
      // Best-effort — a webhook outage shouldn't fail the sign-up that
      // already succeeded on the caller's end by the time this fires.
      console.error('n8n lead webhook forward failed:', err);
    }
  }

  return Response.json({ received: true, forwarded: Boolean(webhookUrl) });
}
