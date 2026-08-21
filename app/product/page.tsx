'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Home,
  Radio as RadioIcon,
  Sparkles,
  Map,
  Users2,
  Brain,
  Globe,
  FileText,
  Search,
  PlayCircle,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
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

const SYNTHESIS_INPUTS = [
  { label: 'Web', Icon: Globe },
  { label: 'Docs', Icon: FileText },
  { label: 'Search', Icon: Search },
  { label: 'Media', Icon: PlayCircle },
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
        {/* Hero — a moonrise-over-mountains mood built from CSS (radial
            glow + a clipped silhouette) plus the app's own real Starfield,
            not a stock/generated photo. */}
        <div className="relative -mx-6 md:mx-0 h-[420px] overflow-hidden rounded-2xl border border-slate-800 flex flex-col items-center pt-16">
          <Starfield contained starCount={180} />
          <div
            className="absolute left-1/2 bottom-0 w-[130%] aspect-square rounded-full pointer-events-none"
            style={{
              transform: 'translate(-50%, 58%)',
              background:
                'radial-gradient(circle at 50% 30%, rgba(226,232,240,0.28) 0%, rgba(129,140,248,0.16) 35%, transparent 70%)',
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-20 bg-[#0a0a0c] pointer-events-none"
            style={{
              clipPath:
                'polygon(0% 100%, 0% 65%, 9% 78%, 20% 45%, 33% 70%, 47% 32%, 59% 74%, 73% 48%, 87% 68%, 100% 58%, 100% 100%)',
            }}
          />
          <div className="relative z-10 max-w-xl px-6 space-y-5 text-center">
            <h1
              className="text-5xl font-bold text-white md:text-6xl"
              style={{ textShadow: '0 0 40px rgba(129,140,248,0.45), 0 0 80px rgba(129,140,248,0.2)' }}
            >
              Ai One
            </h1>
            <p className="text-sm text-slate-400">
              One platform for live cosmic broadcasting, AI-driven inquiry, and a growing archive of curated
              knowledge.
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
                className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg border border-neutral-700 text-white/80 hover:border-neutral-500 hover:text-white hover:bg-white/10 transition bg-black/30 backdrop-blur-sm"
              >
                Try Star Tracker — Free
              </Link>
            </div>
          </div>
        </div>

        {/* Multiverse Feature Grid */}
        <div className="space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-bold text-white">Cosmic Multiverse Hub</h2>
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              Knowledge is infinite. Now it&apos;s interactive.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FEATURES.map(({ title, description, Icon, href, comingSoon }) => {
              const cardClass =
                'flex items-start gap-4 p-5 border rounded-xl bg-slate-900/40 backdrop-blur-sm border-slate-800';
              const content = (
                <>
                  <div className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 bg-gradient-to-br from-blue-600/25 to-purple-600/25 border border-slate-700 text-slate-200">
                    <Icon className="w-4.5 h-4.5" />
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

        {/* Synthesis Engine Diagram — purely illustrative, no functional
            claim beyond illustrating how Kali draws on multiple sources. */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-center text-white">Synthesizing Infinite Knowledge</h2>
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
            <div className="grid grid-cols-2 gap-2">
              {SYNTHESIS_INPUTS.map(({ label, Icon }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded border-slate-800 bg-slate-900/40 text-slate-400"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              ))}
            </div>
            <div className="text-slate-600">→</div>
            <div className="flex flex-col items-center gap-2 px-6 py-5 border rounded-full border-neutral-600 bg-gradient-to-br from-blue-600/20 to-purple-600/20">
              <Brain className="w-6 h-6 text-white" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-center text-white">
                Synthesis
                <br />
                Engine
              </span>
            </div>
            <div className="text-slate-600">→</div>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded border-slate-800 bg-slate-900/40 text-slate-300">
                <TrendingUp className="w-3 h-3" />
                Knowledge Output
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded border-slate-800 bg-slate-900/40 text-slate-300">
                <Lightbulb className="w-3 h-3" />
                New Insights
              </span>
            </div>
          </div>
        </div>

        {/* Tier Pricing Cards — the real, live pricing component, not
            placeholder tiers, so this page never drifts out of sync with
            what checkout actually charges. */}
        <div className="space-y-6 -mx-6">
          <h2 className="text-xl font-bold text-center text-white">Unlock Your Cosmic Guide</h2>
          <div className="h-[560px] rounded-xl overflow-hidden border border-slate-800">
            <PricingPlans />
          </div>
        </div>

        {/* Voice of the Cosmic Pioneers — empty placeholder slots, not
            fabricated quotes. No real testimonials exist yet; inventing
            attributed quotes/avatars here would read as real social proof. */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-center text-white">Voice of the Cosmic Pioneers</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed rounded-xl h-40 border-slate-800 bg-slate-900/20"
              >
                <div className="w-10 h-10 border rounded-full border-slate-700 bg-slate-900/60" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">
                  Testimonial slot {i}
                </span>
                <span className="text-[10px] font-mono text-slate-700">Awaiting real customer feedback</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom hero CTA */}
        <div className="pt-4 space-y-4 text-center">
          <p className="text-sm text-slate-400">The answers are infinite. Start your journey today.</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition"
          >
            Launch AiOne Hub
          </Link>
        </div>

        <div className="pt-8 text-center border-t border-slate-900">
          <p className="pt-6 text-[10px] font-mono uppercase tracking-widest text-slate-600">
            AiOne © {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>

      <SignUpModal isOpen={isSignUpOpen} onClose={() => setIsSignUpOpen(false)} />
    </div>
  );
}
