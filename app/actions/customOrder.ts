'use server';

import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Handles inquiries submitted from /custom-order (the QR-code landing page)
// — a lightweight lead form, not a checkout. Recorded in Supabase so
// there's a durable list to follow up on; there's no fulfillment or
// payment attached at this stage.
export async function submitCustomOrderInquiry(formData: FormData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const details = formData.get('details');
  const ref = formData.get('ref');

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Name is required.');
  }
  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('Email is required.');
  }
  if (typeof details !== 'string' || !details.trim()) {
    throw new Error('Please describe what you need.');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('Supabase is not configured.');
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('custom_order_inquiries').insert({
    name: name.trim(),
    email: email.trim(),
    details: details.trim(),
    ref: typeof ref === 'string' && ref ? ref : null,
  });
  if (error) {
    throw new Error(`Failed to submit inquiry: ${error.message}`);
  }

  redirect(`/custom-order?submitted=1${typeof ref === 'string' && ref ? `&ref=${encodeURIComponent(ref)}` : ''}`);
}
