export const runtime = 'nodejs';

import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from '@aws-sdk/client-sfn';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

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
const sfn = new SFNClient({ region: process.env.AWS_REGION || 'us-east-2' });

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
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

  const { taskToken, approved, reason } = body;
  if (typeof taskToken !== 'string' || !taskToken.trim()) {
    return new Response('taskToken is required.', { status: 400 });
  }
  if (typeof approved !== 'boolean') {
    return new Response('approved (boolean) is required.', { status: 400 });
  }

  try {
    if (approved) {
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

  return Response.json({ ok: true, approved });
}
