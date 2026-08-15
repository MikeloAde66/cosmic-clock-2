'use client';

import React, { useState } from 'react';
import { matchRole } from '@/lib/vaultRoleKeys';

interface PreferencesModalProps {
  isAdmin: boolean;
  onClose: () => void;
  // Called with a validated role key once matchRole confirms it's real —
  // the actual unlock still happens inside CosmicVaultAuth itself (defense
  // in depth: this modal is just the only reachable *path* to it now).
  onUnlockVault: (roleKey: string) => void;
  // Owner Vault Access Rule: a real logged-in admin never sees a key
  // field at all — this jumps straight to the Vault tab; CosmicVaultAuth
  // independently confirms the same real Supabase session and unlocks
  // itself, so there's nothing here that could deny or gate them.
  onOpenVaultForOwner: () => void;
}

export default function PreferencesModal({ isAdmin, onClose, onUnlockVault, onOpenVaultForOwner }: PreferencesModalProps) {
  const [vaultKeyInput, setVaultKeyInput] = useState('');
  const [vaultKeyError, setVaultKeyError] = useState('');

  const handleVaultKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = matchRole(vaultKeyInput);
    if (!role) {
      setVaultKeyError('Invalid key.');
      return;
    }
    onUnlockVault(vaultKeyInput.trim());
    setVaultKeyInput('');
    setVaultKeyError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 space-y-5 border shadow-2xl bg-neutral-950 border-neutral-800 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Preferences</h3>
          <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="pt-4 space-y-2 border-t border-neutral-900">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Vault Access</span>

          {isAdmin ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-emerald-400">Owner session active — no key required.</p>
              <button
                type="button"
                onClick={() => {
                  onOpenVaultForOwner();
                  onClose();
                }}
                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded bg-white text-black hover:bg-neutral-200"
              >
                Open Vault →
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleVaultKeySubmit} className="flex gap-2">
                <input
                  type="password"
                  value={vaultKeyInput}
                  onChange={(e) => {
                    setVaultKeyInput(e.target.value);
                    setVaultKeyError('');
                  }}
                  placeholder="Enter access key..."
                  className="flex-1 min-w-0 px-3 py-2 font-mono text-xs border rounded bg-neutral-900 border-neutral-800 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/50"
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-mono font-bold uppercase rounded bg-white text-black hover:bg-neutral-200"
                >
                  Go
                </button>
              </form>
              {vaultKeyError && <p className="font-mono text-[10px] text-rose-400">{vaultKeyError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
