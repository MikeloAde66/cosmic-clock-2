import dbConnect from '@/lib/dbConnect';
import SupportTicket, { TICKET_CATEGORIES, type TicketCategory } from '@/lib/models/SupportTicket';

export const runtime = 'nodejs';

// Submitted from inside the already-unlocked Vault SUPPORT drawer — no
// separate auth gate needed here beyond having reached that view at all.
export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }

  let body: { category?: string; description?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { category, description, email } = body;
  if (
    !category ||
    !TICKET_CATEGORIES.includes(category as (typeof TICKET_CATEGORIES)[number]) ||
    !description?.trim() ||
    !email?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return new Response('A valid category, description, and email are required.', { status: 400 });
  }
  const validCategory = category as TicketCategory;

  try {
    await dbConnect();
    const ticket = await SupportTicket.create({
      category: validCategory,
      description: description.trim(),
      email: email.trim(),
    });
    return Response.json({ ticket: { id: ticket._id.toString(), createdAt: ticket.createdAt.toISOString() } });
  } catch (err) {
    console.error('Support ticket create error:', err);
    const message = err instanceof Error ? err.message : 'Failed to submit ticket.';
    return new Response(message, { status: 500 });
  }
}
