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

      {/* Compact header bar — Home link left, small glowing "Ai One"
          wordmark centered. No badge on the right: there never was one
          anywhere in this app to remove. */}
      <div className="relative z-20 flex items-center h-14 max-w-5xl px-6 mx-auto">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded-lg border transition bg-white/[0.04] backdrop-blur-xl border-white/10 text-white/70 hover:border-indigo-400/40 hover:text-white hover:bg-white/[0.08] shadow-[0_0_16px_rgba(99,102,241,0.08)] hover:shadow-[0_0_20px_rgba(129,140,248,0.25)]"
        >
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
        <span
          className="absolute -translate-x-1/2 left-1/2 text-base font-bold tracking-wide text-white"
          style={{ textShadow: '0 0 12px rgba(103,232,249,0.6), 0 0 20px rgba(168,85,247,0.4)' }}
        >
          Ai One
        </span>
      </div>

      <div className="relative z-10 max-w-5xl px-6 pb-24 mx-auto space-y-24">
        {/* Hero — real artwork background (cropped to pure scenery, no
            text baked in) plus the app's own real Starfield for extra
            depth, with the real headline/button as HTML on top. */}
        <div
          className="relative -mx-6 md:mx-0 h-[420px] overflow-hidden rounded-2xl border border-white/10 flex flex-col items-center pt-16 bg-[#0a0a0c] shadow-[0_0_50px_rgba(99,102,241,0.12)]"
          style={{
            backgroundImage: 'url(/images/aione-landing-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 70%',
          }}
        >
          <Starfield contained starCount={90} />
          {/* Vignette for text legibility over the bright planet glow. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(10,10,12,0.55) 0%, transparent 55%), linear-gradient(to bottom, rgba(10,10,12,0.35) 0%, transparent 30%)',
            }}
          />
          <div className="relative z-10 max-w-xl px-6 space-y-6 text-center">
            <h1
              className="text-3xl font-bold text-white md:text-4xl"
              style={{ textShadow: '0 0 40px rgba(129,140,248,0.45), 0 0 80px rgba(129,140,248,0.2)' }}
            >
              Explore the Cosmos, Powered by AI
            </h1>
            <button
              onClick={() => setIsSignUpOpen(true)}
              className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-[0_0_24px_rgba(124,58,237,0.45)] hover:shadow-[0_0_34px_rgba(124,58,237,0.65)] hover:opacity-95 transition"
            >
              Subscribe
            </button>
          </div>
        </div>

        {/* Star Tracker's free-entry CTA — kept on the page (just moved out
            of the now-decluttered hero) since it was an explicit routing
            requirement from earlier in this project: zero-friction access
            to the free tool, not something to drop silently. */}
        <div className="text-center">
          <Link
            href="/star-tracker"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-mono uppercase tracking-wide rounded-lg border transition bg-white/[0.04] backdrop-blur-xl border-white/10 text-white/70 hover:border-indigo-400/40 hover:text-white hover:bg-white/[0.08] shadow-[0_0_16px_rgba(99,102,241,0.08)] hover:shadow-[0_0_20px_rgba(129,140,248,0.25)]"
          >
            Try Star Tracker — Free
          </Link>
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
                'flex items-start gap-4 p-5 border rounded-xl bg-white/[0.04] backdrop-blur-xl border-white/10 shadow-[0_0_20px_rgba(99,102,241,0.06)]';
              const content = (
                <>
                  <div
                    className="relative flex items-center justify-center w-16 h-16 overflow-hidden border rounded-xl shrink-0 border-slate-700 text-slate-100"
                    style={{
                      background:
                        'radial-gradient(circle at 30% 30%, rgba(129,140,248,0.35), rgba(88,28,135,0.25) 55%, rgba(10,10,12,0.9) 90%)',
                    }}
                  >
                    <div className="absolute w-10 h-10 border rounded-full border-white/10" />
                    <Icon className="w-6 h-6 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]" />
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
                <Link
                  key={title}
                  href={href}
                  className={`${cardClass} transition hover:border-indigo-400/30 hover:shadow-[0_0_28px_rgba(129,140,248,0.18)]`}
                >
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded-lg border-white/10 bg-white/[0.04] backdrop-blur-xl text-slate-400 shadow-[0_0_14px_rgba(99,102,241,0.06)]"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              ))}
            </div>
            <div className="text-slate-600">→</div>
            <div className="flex flex-col items-center gap-2 px-6 py-5 border rounded-full border-indigo-400/30 bg-white/[0.04] backdrop-blur-xl shadow-[0_0_36px_rgba(124,58,237,0.3)]">
              <Brain className="w-6 h-6 text-white drop-shadow-[0_0_8px_rgba(129,140,248,0.7)]" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-center text-white">
                Synthesis
                <br />
                Nebula
              </span>
            </div>
            <div className="text-slate-600">→</div>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded-lg border-white/10 bg-white/[0.04] backdrop-blur-xl text-slate-300 shadow-[0_0_14px_rgba(99,102,241,0.06)]">
                <TrendingUp className="w-3 h-3" />
                Knowledge Output
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded-lg border-white/10 bg-white/[0.04] backdrop-blur-xl text-slate-300 shadow-[0_0_14px_rgba(99,102,241,0.06)]">
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
          <div className="h-[560px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_40px_rgba(99,102,241,0.08)]">
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
                className="flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed rounded-xl h-40 border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_16px_rgba(99,102,241,0.05)]"
              >
                <div className="w-10 h-10 border rounded-full border-white/10 bg-white/[0.04]" />
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
            className="inline-block px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-[0_0_24px_rgba(124,58,237,0.45)] hover:shadow-[0_0_34px_rgba(124,58,237,0.65)] hover:opacity-95 transition"
          >
            Launch AiOne Hub
          </Link>
        </div>

        <div className="pt-8 space-y-1 text-center border-t border-slate-900">
          <p className="pt-6 text-[10px] font-mono uppercase tracking-widest text-slate-600">
            AiOne © {new Date().getFullYear()} — All rights reserved
          </p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">Built for explorers of truth</p>
        </div>
      </div>

      <SignUpModal isOpen={isSignUpOpen} onClose={() => setIsSignUpOpen(false)} />
    </div>
  );
}
