'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { skyviewCutoutUrl, SKY_BAND_LABELS, SKY_BAND_ORDER, type SkyBand } from '@/lib/skyviewSurveys';

export interface DeepSkySpectrumTarget {
  id: string;
  name: string;
  raHours: number;
  decDeg: number;
  type: string;
  distanceLy: number;
}

// Real public sky-survey imagery (NASA SkyView, see lib/skyviewSurveys —
// runquery.pl?Return=JPEG returns a real cutout JPEG directly, no server
// proxy needed) for whichever Messier target is currently selected on the
// sky map — not synthesized or invented per-target artwork. The text
// summary below is a real Kali/LLM call (same /api/ai-one-chat endpoint the
// rest of this view already uses for narration), explicitly labeled as
// AI-generated commentary rather than presented as precise catalog
// measurements (real redshift/spectral-type/mass values would require a
// real catalog lookup — e.g. SIMBAD — which this pass doesn't wire up, so
// it isn't claimed here).
export default function DeepSkySpectrumPanel({ target }: { target: DeepSkySpectrumTarget | null }) {
  const [band, setBand] = useState<SkyBand>('optical');
  const [imageFailed, setImageFailed] = useState(false);

  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    setImageFailed(false);
  }, [target, band]);

  useEffect(() => {
    if (!target) return;
    setSummary('');
    setSummaryError('');
    setSummaryLoading(true);
    const controller = new AbortController();
    fetch('/api/ai-one-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `In two or three sentences, describe ${target.name} (${target.id}), a ${target.type} roughly ${target.distanceLy.toLocaleString()} light-years away, and what looking at it in different wavelengths (optical/infrared/radio/X-ray) tends to reveal about objects of this kind.`,
          },
        ],
        mode: 'synthesis',
        language: 'en',
        voiceMode: false,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error('Kali could not be reached.');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setSummary(full);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setSummaryError(err instanceof Error ? err.message : 'Kali could not be reached.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false);
      });
    return () => controller.abort();
  }, [target]);

  if (!target) {
    return (
      <p className="p-3 font-mono text-xs text-center text-slate-500">
        Switch Sky Maps to Messier Deep-Sky and select an object to see its multi-wavelength imagery here.
      </p>
    );
  }

  const raDeg = target.raHours * 15;
  const imageUrl = skyviewCutoutUrl(raDeg, target.decDeg, band, 0.5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">
          {target.name} <span className="font-mono text-slate-500">({target.id})</span>
        </span>
        <div className="flex gap-1">
          {SKY_BAND_ORDER.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBand(b)}
              className={`px-2 py-1 text-[9px] font-mono uppercase tracking-wide rounded border transition ${
                band === b ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-500 hover:border-slate-500'
              }`}
              title={SKY_BAND_LABELS[b]}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center overflow-hidden bg-black border rounded aspect-square border-slate-800">
        {imageFailed ? (
          <p className="p-4 font-mono text-[10px] text-center text-slate-500">No imagery available for this band/target.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- external, per-request-generated NASA SkyView JPEG, not a static local/optimizable asset
          <img
            key={imageUrl}
            src={imageUrl}
            alt={`${target.name} — ${SKY_BAND_LABELS[band]}`}
            className="object-contain w-full h-full"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
      <p className="font-mono text-[9px] text-slate-600">Real {SKY_BAND_LABELS[band]} survey imagery from NASA&apos;s SkyView Virtual Observatory.</p>

      <div className="pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3 text-purple-300" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-purple-300/80">Kali — AI-generated summary</span>
        </div>
        {summaryError ? (
          <p className="text-xs text-red-400">{summaryError}</p>
        ) : summary ? (
          <p className="text-xs leading-relaxed text-slate-200">{summary}</p>
        ) : summaryLoading ? (
          <p className="text-xs text-slate-500">Kali is thinking…</p>
        ) : null}
      </div>
    </div>
  );
}
