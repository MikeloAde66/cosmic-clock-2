'use client';

import React, { useState } from 'react';
import { AtomIcon, Check, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PendingApproval } from '@/app/api/kali/pending-approvals/route';

interface QuantumApprovalModalProps {
  approvals: PendingApproval[];
  onClose: () => void;
  onDecided: () => void; // triggers the parent's refetch after a decision
}

async function getAuthHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function truncateToken(token: string) {
  return token.length > 24 ? `${token.slice(0, 12)}…${token.slice(-8)}` : token;
}

// Admin-only approval dashboard for real Amazon Braket QPU tasks — see
// aws/step-functions/kali-quantum-workflow.json (the pipeline this
// approves/rejects) and aws/README.md (the real-money context: approving
// here is the one thing that lets a paused execution actually spend on
// physical quantum hardware). Fed by useKaliPendingApprovals, which only
// polls at all for a signed-in admin.
export default function QuantumApprovalModal({ approvals, onClose, onDecided }: QuantumApprovalModalProps) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const showToast = (text: string, kind: 'success' | 'error') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const decide = async (approval: PendingApproval, action: 'approve' | 'reject') => {
    setPendingActionId(approval.id);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
      const res = await fetch('/api/kali/approve-task', {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskToken: approval.task_token, action }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast(action === 'approve' ? 'Task approved — submitting to the real QPU.' : 'Task rejected.', 'success');
      onDecided();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record the decision.', 'error');
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-hidden border rounded-2xl border-slate-800 bg-slate-950/90 backdrop-blur-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <AtomIcon className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Quantum Task Approvals</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {approvals.length === 0 && (
            <p className="py-10 text-sm text-center text-slate-500">No pending approvals right now.</p>
          )}
          {approvals.map((a) => (
            <div key={a.id} className="p-4 border rounded-xl border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
                {a.estimated_cost_usd != null && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    est. ${a.estimated_cost_usd.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                <div>
                  <span className="text-slate-500">Qubits: </span>
                  <span className="text-slate-200">{a.qubit_count ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Target: </span>
                  <span className="text-slate-200 truncate">{a.target_qpu ?? '—'}</span>
                </div>
              </div>
              {a.circuit_summary && <p className="mb-2 text-xs leading-relaxed text-slate-400">{a.circuit_summary}</p>}
              <p className="mb-3 font-mono text-[10px] text-slate-600 truncate" title={a.task_token}>
                token: {truncateToken(a.task_token)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => decide(a, 'approve')}
                  disabled={pendingActionId === a.id}
                  className="flex items-center justify-center flex-1 gap-1.5 h-9 text-xs font-bold uppercase tracking-wide rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  {pendingActionId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Approve
                </button>
                <button
                  onClick={() => decide(a, 'reject')}
                  disabled={pendingActionId === a.id}
                  className="flex items-center justify-center flex-1 gap-1.5 h-9 text-xs font-bold uppercase tracking-wide border rounded-lg border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        {toast && (
          <div
            className={`m-3 mt-0 px-3 py-2 rounded-lg text-xs font-mono shrink-0 ${
              toast.kind === 'success' ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}
