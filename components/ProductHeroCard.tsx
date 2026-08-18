import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// The hero images already have their own baked-in headline, price, and CTA
// button drawn into the graphic itself — so the whole card is the single
// clickable target (ctaLabel becomes the link's accessible name, since a
// screen reader has no way to read the CTA text that's baked into the
// image) instead of stacking a second, separately-clickable text button
// underneath a poster that already shows one.
export default function ProductHeroCard({
  heroImageSrc,
  videoSrc,
  heroTagline,
  ctaLabel,
  ctaHref,
}: {
  heroImageSrc: string;
  videoSrc?: string;
  heroTagline: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex items-center justify-center w-full h-full p-6">
      <Link
        href={ctaHref}
        aria-label={ctaLabel}
        className="relative block w-full max-w-md h-[480px] overflow-hidden transition border rounded-xl border-slate-800 bg-[#0B0E14] hover:border-neutral-500"
      >
        {videoSrc ? (
          <video
            src={videoSrc}
            poster={heroImageSrc}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 object-contain w-full h-full"
          />
        ) : (
          <Image src={heroImageSrc} alt={heroTagline} fill sizes="(max-width: 640px) 100vw, 448px" className="object-contain" />
        )}
      </Link>
    </div>
  );
}
