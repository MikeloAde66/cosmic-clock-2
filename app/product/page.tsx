'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Home, Radio as RadioIcon, Sparkles, Map, Users2 } from 'lucide-react';
import Starfield from '@/components/Starfield';
import SignUpModal from '@/components/SignUpModal';
import PricingPlans from '@/components/PricingPlans';

// The "Product Gate" explainer page — distinct from /products (the real
// hardware catalog: HydroNode Pro, Builder Kit, Ai One Core, Star Tracker).
// This one explains the software side of AiOne: the AI chat/knowledge
// features and subscription tiers. Two feature cards below are real
// (Kali chat, Radio Central); two are honestly labeled "Coming Soon" since
// no personal-knowledge-map or multi-user collaboration feature exists
// anywhere in the app yet — see Studio One's localStorage-only architecture.
const FEATURES = [
  {
    title: 'Deep Cosmic Inquiry',
    description: 'Ask Kali about ancient technology, quantum physics, and epoch cycles — real-time AI chat.',
    Icon: Sparkles,
    href: '/',
    comingSoon: false,
  },
  {
    title: 'Real-Time Knowledge Feeds',
    description: 'Live global stations across Radio Central — news, comedy, history, and cosmic ambient channels.',
    Icon: RadioIcon,
    href: '/',
    comingSoon: false,
  },
  {
    title: 'Personal Knowledge Map',
    description: 'A visual map of everything you’ve explored across AiOne.',
    Icon: Map,
    href: null,
    comingSoon: true,
  },
  {
    title: 'Collaborative Exploration',
    description: 'Shared sessions and multi-user discovery, built on top of AiOne.',
    Icon: Users2,
    href: null,
    comingSoon: true,
  },
];

export default function ProductGatePage() {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <Link
        href="/"
        aria-label="Home"
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
      >
        <Home className="w-3.5 h-3.5" />
        Home
      </Link>

      <div className="relative z-10 max-w-5xl px-6 py-24 mx-auto space-y-24">
        {/* Hero */}
        <div className="space-y-6 text-center">
          <span className="inline-block px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 border border-slate-800 rounded-full">
            The AiOne Platform
          </span>
          <h1 className="text-4xl font-bold md:text-5xl">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
              Explore the Cosmos
            </span>
            , Powered by AI
          </h1>
          <p className="max-w-xl mx-auto text-sm text-slate-400">
            One platform for live cosmic broadcasting, AI-driven inquiry, and a growing archive of curated knowledge.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsSignUpOpen(true)}
              className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition"
            >
              Subscribe
            </button>
            <Link
              href="/star-tracker"
              className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg border border-neutral-700 text-white/80 hover:border-neutral-500 hover:text-white hover:bg-white/10 transition"
            >
              Try Star Tracker — Free
            </Link>
          </div>
        </div>

        {/* Multiverse Feature Grid */}
        <div className="space-y-6">
          <h2 className="text-xs font-mono font-bold tracking-widest text-center uppercase text-slate-500">
            The Multiverse of Features
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FEATURES.map(({ title, description, Icon, href, comingSoon }) => {
              const cardClass =
                'flex items-start gap-4 p-5 border rounded-xl bg-slate-900/40 backdrop-blur-sm border-slate-800';
              const content = (
                <>
                  <div className="flex items-center justify-center w-10 h-10 border rounded-lg shrink-0 border-slate-700 bg-slate-950/60 text-slate-300">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{title}</h3>
                      {comingSoon && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded border-slate-700 text-slate-500">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{description}</p>
                  </div>
                </>
              );
              return href ? (
                <Link key={title} href={href} className={`${cardClass} hover:border-slate-700 transition`}>
                  {content}
                </Link>
              ) : (
                <div key={title} className={cardClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        {/* Synthesis Engine Diagram */}
        <div className="space-y-6">
          <h2 className="text-xs font-mono font-bold tracking-widest text-center uppercase text-slate-500">
            The Synthesis Engine
          </h2>
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-400">
              {['Web', 'Docs', 'Search', 'Media'].map((label) => (
                <span key={label} className="px-3 py-1.5 border rounded border-slate-800 bg-slate-900/40 text-center">
                  {label}
                </span>
              ))}
            </div>
            <div className="text-slate-600">→</div>
            <div className="px-6 py-4 text-xs font-mono font-bold uppercase tracking-wide text-center text-white border rounded-lg border-neutral-600 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
              Synthesis
              <br />
              Engine
            </div>
            <div className="text-slate-600">→</div>
            <span className="px-4 py-2.5 text-[10px] font-mono uppercase tracking-wide border rounded border-slate-800 bg-slate-900/40 text-slate-300">
              Interactive Knowledge Output
            </span>
          </div>
        </div>

        {/* Tier Pricing Cards — the real, live pricing component, not
            placeholder tiers, so this page never drifts out of sync with
            what checkout actually charges. */}
        <div className="space-y-6 -mx-6">
          <h2 className="text-xs font-mono font-bold tracking-widest text-center uppercase text-slate-500">
            Choose Your Plan
          </h2>
          <div className="h-[560px] rounded-xl overflow-hidden border border-slate-800">
            <PricingPlans />
          </div>
        </div>

        {/* Voice of Cosmic Pioneers — empty placeholder slots, not
            fabricated quotes. No real testimonials exist yet; inventing
            attributed quotes here would read as real social proof. */}
        <div className="space-y-6">
          <h2 className="text-xs font-mono font-bold tracking-widest text-center uppercase text-slate-500">
            Voice of Cosmic Pioneers
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed rounded-xl h-36 border-slate-800 bg-slate-900/20"
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">
                  Testimonial slot {i}
                </span>
                <span className="text-[10px] font-mono text-slate-700">Awaiting real customer feedback</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom hero CTA */}
        <div className="pt-4 text-center">
          <Link
            href="/"
            className="inline-block px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition"
          >
            Launch AiOne Hub
          </Link>
        </div>
      </div>

      <SignUpModal isOpen={isSignUpOpen} onClose={() => setIsSignUpOpen(false)} />
    </div>
  );
}
