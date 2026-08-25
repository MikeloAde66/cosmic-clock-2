'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'signup';
type Method = 'magic' | 'password';
type Step = 'form' | 'sent' | 'done';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: Mode;
}

// Small inline spinner — CSS animation only, no image/icon dependency.
function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 border-2 rounded-full border-slate-950/30 border-t-slate-950 animate-spin"
      aria-hidden="true"
    />
  );
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>('magic');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reopening with a different initialMode (e.g. the deep-link switching
  // from ?auth=login to ?auth=signup) should reset to that tab, not keep
  // whatever was left over from the last time this modal was open.
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;

    // Already signed in (e.g. a magic-link click brought them back here) —
    // no need to show a form at all.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) onClose();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') onClose();
    });
    return () => subscription.subscription.unsubscribe();
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    onClose();
    setTimeout(() => {
      setStep('form');
      setEmail('');
      setPassword('');
      setError('');
    }, 200);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep('form');
    setError('');
  };

  const switchMethod = (next: Method) => {
    setMethod(next);
    setError('');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      if (method === 'magic') {
        const { error: sendError } = await supabase.auth.signInWithOtp({ email: email.trim() });
        if (sendError) throw sendError;
        setStep('sent');
        return;
      }

      // Password path — a real, separate credential from magic-link/OTP.
      // An account only has a password if it was actually set via signUp()
      // with one, or set later; a magic-link-only account can't log in
      // this way until it does.
      if (!password) {
        setError('Enter a password.');
        return;
      }

      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError) throw loginError;
        // onAuthStateChange above closes the modal on success.
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        // If the project requires email confirmation, there's no session
        // yet — show that honestly instead of pretending sign-up finished.
        if (!data.session) {
          setStep('done');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT';
  const submitLabel =
    method === 'magic'
      ? loading
        ? 'Sending…'
        : 'Send Sign-In Link'
      : loading
        ? mode === 'login'
          ? 'Logging in…'
          : 'Creating account…'
        : mode === 'login'
          ? 'Log In'
          : 'Create Account';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 w-full max-w-md relative shadow-2xl font-mono">
        <button onClick={resetAndClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <X size={18} />
        </button>

        {step === 'form' && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-slate-800">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  mode === 'login' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  mode === 'signup' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <h3 className="text-lg font-bold text-white tracking-wider">{title}</h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-slate-800 rounded p-2.5 text-sm text-slate-100 outline-none focus:border-white/50"
              />

              {method === 'password' && (
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/60 border border-slate-800 rounded p-2.5 text-sm text-slate-100 outline-none focus:border-white/50"
                />
              )}

              <button
                type="button"
                onClick={() => switchMethod(method === 'magic' ? 'password' : 'magic')}
                className="text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-2"
              >
                {method === 'magic' ? 'Use a password instead' : 'Use a magic link instead'}
              </button>

              {method === 'password' && mode === 'login' && (
                <p className="text-[10px] text-slate-500">
                  Only works if this account already has a password set — magic-link-only accounts should use the
                  magic link option.
                </p>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-neutral-200 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded text-sm transition-colors"
              >
                {loading && <Spinner />}
                {submitLabel}
              </button>
            </form>
          </div>
        )}

        {step === 'sent' && (
          <div className="space-y-4 text-center">
            <h3 className="text-lg font-bold text-white tracking-wider">CHECK YOUR EMAIL</h3>
            <p className="text-xs text-slate-400">
              We sent a sign-in link to <span className="text-slate-100">{email}</span>. Click it to
              {mode === 'login' ? ' log in' : ' finish creating your account'} — this window will close
              automatically once you're signed in.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <h3 className="text-lg font-bold text-white tracking-wider">CONFIRM YOUR EMAIL</h3>
            <p className="text-xs text-slate-400">
              We sent a confirmation link to <span className="text-slate-100">{email}</span>. Click it, then log in
              with your new password.
            </p>
            <button
              onClick={resetAndClose}
              className="w-full bg-white hover:bg-neutral-200 text-slate-950 font-bold py-2.5 rounded text-sm transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
