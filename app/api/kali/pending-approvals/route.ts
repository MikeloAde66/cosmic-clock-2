export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export interface PendingApproval {
  id: string;
  task_token: string;
  status: 'pending' | 'approved' | 'rejected';
  qubit_count: number | null;
  target_qpu: string | null;
  estimated_cost_usd: number | null;
  circuit_summary: string | null;
  created_at: string;
}

// What components/kali/QuantumApprovalModal.tsx polls — same admin gate
// as approve-task, since a pending row's task_token is sensitive (it's
// what lets someone call SendTaskSuccess/SendTaskFailure against a real
// paused execution).
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('kali_quantum_approvals')
    .select('id, task_token, status, qubit_count, target_qpu, estimated_cost_usd, circuit_summary, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return Response.json({ approvals: (data ?? []) as PendingApproval[] });
}
