export const runtime = 'nodejs';

import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from '@aws-sdk/client-sfn';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Admin-gated, same as every other sensitive action in this app (see
// lib/adminAuth.ts) — approving here is what lets
// aws/step-functions/kali-quantum-workflow.json's RequestApproval state
// proceed straight to ExecuteOnQpu, which spends real money on a physical
// quantum device the moment it runs. This is not a "nice to restrict"
// choice; an unauthenticated version of this route would let anyone on
// the internet approve real hardware spend.
//
// Needs AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY configured in
// the environment (standard AWS SDK v3 credential resolution — not read
// explicitly here, same as how lib/supabaseAdmin.ts documents its own
// required env vars rather than hardcoding anything). The IAM
// identity these keys belong to needs states:SendTaskSuccess and
// states:SendTaskFailure permission on the deployed state machine's ARN.
const sfn = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' });

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { taskToken, action, reason } = body;
  if (typeof taskToken !== 'string' || !taskToken.trim()) {
    return new Response('taskToken is required.', { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return new Response("action must be 'approve' or 'reject'.", { status: 400 });
  }

  try {
    if (action === 'approve') {
      await sfn.send(
        new SendTaskSuccessCommand({
          taskToken,
          output: JSON.stringify({ approved: true, approvedAt: new Date().toISOString() }),
        })
      );
    } else {
      await sfn.send(
        new SendTaskFailureCommand({
          taskToken,
          error: 'ApprovalRejected',
          cause: typeof reason === 'string' && reason.trim() ? reason : 'Rejected via the approval dashboard.',
        })
      );
    }
  } catch (err) {
    // Most likely causes here: the token already expired/was already used
    // (Step Functions tokens are single-use), or this environment's AWS
    // credentials aren't configured/don't have SendTaskSuccess/Failure
    // permission on the state machine.
    return new Response(err instanceof Error ? err.message : 'Failed to notify Step Functions.', { status: 500 });
  }

  // Best-effort — the real decision already went through to AWS above;
  // this just keeps the dashboard's own record in sync so a resolved
  // approval stops showing up in GET /api/kali/pending-approvals. A
  // failure here doesn't mean the approval/rejection didn't happen.
  const admin = getSupabaseAdmin();
  await admin
    .from('kali_quantum_approvals')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq('task_token', taskToken)
    .then(null, () => {});

  return Response.json({ ok: true, action });
}
