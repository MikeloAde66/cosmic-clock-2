'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'code' | 'terms' | 'profile' | 'done';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignUpModal({ isOpen, onClose }: SignUpModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [address, setAddress] = useState('');
  const [preferences, setPreferences] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // If we got here because a magic-link click already authenticated the
    // user (no code was ever typed in), skip straight past the dead
    // email/code steps into terms instead of showing a code box no one can
    // fill in.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && (step === 'email' || step === 'code')) {
        setStep('terms');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    // Reset for next time the modal opens, after the close animation would run
    setTimeout(() => {
      setStep('email');
      setEmail('');
      setCode('');
      setTermsAgreed(false);
      setAddress('');
      setPreferences('');
      setError('');
    }, 200);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    localStorage.setItem('cosmic_auth_intent', 'signup');
    const { error: sendError } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setStep('code');
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setStep('terms');
  };

  const completeProfile = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      // Best-effort — a `profiles` table may not exist yet in this project;
      // sign-up itself has already succeeded regardless of this outcome.
      await supabase
        .from('profiles')
        .upsert({ id: userData.user.id, mailing_address: address, preferences })
        .then(null, () => {});
    }
    // Best-effort lead event — sign-up has already succeeded above
    // regardless of whether this call or its n8n forward succeeds.
    // userData.user.email covers the magic-link path, where the email
    // step (and its local `email` state) was skipped entirely.
    const leadEmail = userData?.user?.email ?? email.trim();
    if (leadEmail) {
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leadEmail, source: 'signup', address, preferences }),
      }).catch(() => {});
    }
    setLoading(false);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 w-full max-w-md relative shadow-2xl font-mono">
        <button onClick={handleClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <X size={18} />
        </button>

        {step === 'email' && (
          <form onSubmit={sendCode} className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wider">CREATE ACCOUNT</h3>
            <p className="text-xs text-slate-400">
              Enter your email address to receive a sign-in link (or code, depending on your account settings).
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
              {loading ? 'Sending…' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verifyCode} className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wider">VERIFY EMAIL</h3>
            <p className="text-xs text-slate-400">
              Enter the code sent to <span className="text-slate-100">{email}</span>
            </p>
            <input
              type="text"
              required
              placeholder="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-black/60 border border-slate-800 rounded p-2.5 text-center text-lg tracking-widest text-slate-100 outline-none focus:border-white/50"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-neutral-200 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded text-sm transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        {step === 'terms' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wider">LEGAL AGREEMENT</h3>
            <div className="h-32 bg-black/60 border border-slate-800 rounded p-3 text-xs text-slate-400 overflow-y-auto space-y-2">
              <p>
                <strong className="text-slate-300">Placeholder Terms & Privacy Notice:</strong> this text is a
                stand-in and is not a real legal agreement. Replace it with your actual Terms of Service and
                Privacy Policy before this flow is used by real users.
              </p>
            </div>
            <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="accent-white w-4 h-4 rounded"
              />
              I agree to the Terms & Conditions and Privacy Policy
            </label>
            <button
              disabled={!termsAgreed}
              onClick={() => setStep('profile')}
              className="w-full bg-white hover:bg-neutral-200 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded text-sm transition-colors"
            >
              Continue to AI ONE
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">WELCOME TO AI ONE</h3>
            </div>
            <div className="space-y-2 text-xs">
              <input
                type="text"
                placeholder="Mailing Address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-black/60 border border-slate-800 rounded p-2 text-slate-100 outline-none focus:border-white/50"
              />
              <input
                type="text"
                placeholder="Preferences (optional)"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full bg-black/60 border border-slate-800 rounded p-2 text-slate-100 outline-none focus:border-white/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <button disabled className="bg-slate-900 p-2 rounded text-slate-600 text-left cursor-not-allowed">
                  2-Step Verify (Coming Soon)
                </button>
                <button disabled className="bg-slate-900 p-2 rounded text-slate-600 text-left cursor-not-allowed">
                  Link Billing (Coming Soon)
                </button>
              </div>
            </div>
            <button
              onClick={completeProfile}
              disabled={loading}
              className="w-full bg-white hover:bg-neutral-200 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded text-sm transition-colors mt-2"
            >
              {loading ? 'Saving…' : 'Complete Setup'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <h3 className="text-xl font-bold text-white">YOU'RE IN</h3>
            <p className="text-xs text-slate-400">Your account is set up. Welcome to Ai One.</p>
            <button
              onClick={handleClose}
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
