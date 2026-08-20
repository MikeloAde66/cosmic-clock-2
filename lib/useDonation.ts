'use client';

import { useState } from 'react';

// Shared by DonationButton (LeftNav's compact/row/default variants) and the
// Gallery Grid layout's Donate card — same Stripe checkout session logic,
// pulled out so neither has to duplicate it.
export function useDonation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const donate = async () => {
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

  return { loading, error, donate };
}
