export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// The real link between aws/step-functions/kali-quantum-workflow.json's
// RequestApproval state and anything a dashboard could poll: that state
// publishes to the kali-quantum-approvals SNS topic, but SNS only ever
// reaches whatever's actually subscribed to it. This route IS that
// subscription target (an SNS "HTTPS" subscription pointed at this URL) —
// without it, a pending approval exists only inside AWS's paused
// execution state and whatever raw email/webhook SNS happens to deliver
// it to, never anywhere a UI could list it from.
//
// KNOWN LIMITATION: this does not verify SNS's message signature (would
// need to fetch AWS's signing cert and verify an RSA-SHA1 signature —
// real hardening work, not implemented in this pass). Worst case of a
// forged request here is a fake row appearing in the pending list; the
// actual SendTaskSuccess/SendTaskFailure call in
// app/api/kali/approve-task still only succeeds against a real, live
// Step Functions task token, so a forged entry can't itself trigger real
// QPU spend — but it's still worth hardening before relying on this for
// anything sensitive.
export async function POST(request: Request) {
  const messageType = request.headers.get('x-amz-sns-message-type');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  // SNS requires the subscribing endpoint to confirm itself by fetching
  // the one-time SubscribeURL it sends — done here automatically so
  // there's no manual step after running aws/setup-kali-quantum-infra.sh
  // and pointing an HTTPS subscription at this route.
  if (messageType === 'SubscriptionConfirmation') {
    if (typeof body.SubscribeURL === 'string') {
      await fetch(body.SubscribeURL);
      return Response.json({ ok: true, confirmed: true });
    }
    return new Response('SubscriptionConfirmation message had no SubscribeURL.', { status: 400 });
  }

  if (messageType !== 'Notification') {
    return new Response(`Unhandled SNS message type: ${messageType ?? '(missing header)'}`, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body.Message as string);
  } catch {
    return new Response('SNS Message body was not valid JSON.', { status: 400 });
  }

  const { taskToken, qubitCount, targetQpu, estimatedCostUsd, circuitSummary } = payload;
  if (typeof taskToken !== 'string' || !taskToken.trim()) {
    return new Response('Message is missing taskToken.', { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('kali_quantum_approvals').upsert(
    {
      task_token: taskToken,
      status: 'pending',
      qubit_count: typeof qubitCount === 'number' ? qubitCount : null,
      target_qpu: typeof targetQpu === 'string' ? targetQpu : null,
      estimated_cost_usd: typeof estimatedCostUsd === 'number' ? estimatedCostUsd : null,
      circuit_summary: typeof circuitSummary === 'string' ? circuitSummary : null,
    },
    { onConflict: 'task_token' }
  );
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return Response.json({ ok: true });
}
