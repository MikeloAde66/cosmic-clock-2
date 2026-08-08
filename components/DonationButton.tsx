'use client';

import React, { useState } from 'react';

export default function DonationButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDonation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/create-donation-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_in_cents: 500, // $5.00 test donation
          is_recurring: false,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || 'Checkout session failed.');
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch {
      setError('DONATIONS UNREACHABLE.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleDonation}
        disabled={loading}
        className="px-4 py-2 text-xs font-mono tracking-widest uppercase border border-slate-700 bg-slate-900/80 hover:bg-slate-800 disabled:opacity-50 text-slate-200 rounded transition"
      >
        {loading ? '…' : 'Donations'}
      </button>
      <span className="text-[10px] font-mono text-slate-500 tracking-wider">
        {error || 'Support the Mission'}
      </span>
    </div>
  );
}
