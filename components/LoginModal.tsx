'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'sent';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // If a session already exists (e.g. clicking the emailed link brought
    // the user back here already signed in), just close — no need to
    // linger on the "check your email" screen.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) onClose();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && localStorage.getItem('cosmic_auth_intent') === 'login') {
        onClose();
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('email');
      setEmail('');
      setError('');
    }, 200);
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    localStorage.setItem('cosmic_auth_intent', 'login');
    const { error: sendError } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setStep('sent');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 w-full max-w-md relative shadow-2xl font-mono">
        <button onClick={handleClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <X size={18} />
        </button>

        {step === 'email' && (
          <form onSubmit={sendLink} className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wider">LOG IN</h3>
            <p className="text-xs text-slate-400">
              Enter your email to receive a sign-in link (or code, depending on your account settings).
            </p>
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/60 border border-slate-800 rounded p-2.5 text-sm text-slate-100 outline-none focus:border-white/50"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-neutral-200 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded text-sm transition-colors"
            >
              {loading ? 'Sending…' : 'Send Sign-In Link'}
            </button>
          </form>
        )}

        {step === 'sent' && (
          <div className="space-y-4 text-center">
            <h3 className="text-lg font-bold text-white tracking-wider">CHECK YOUR EMAIL</h3>
            <p className="text-xs text-slate-400">
              We sent a sign-in link to <span className="text-slate-100">{email}</span>. Click it to log in — this
              window will close automatically once you're signed in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
