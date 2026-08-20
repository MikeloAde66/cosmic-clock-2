'use client';

import React, { useEffect, useId, useState } from 'react';
import DOMPurify from 'dompurify';
import { Download } from 'lucide-react';
import { downloadSvg, downloadSvgAsPng } from '@/lib/exportChat';

// mermaid is loaded lazily (dynamic import) rather than at module scope —
// it's a sizable library and most messages never contain a mermaid block.
let mermaidInitPromise: Promise<typeof import('mermaid').default> | null = null;
function getMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      return mermaid;
    });
  }
  return mermaidInitPromise;
}

// Mermaid's own output is generated from parsed diagram syntax, not raw
// HTML, but diagram labels can still carry attacker-controlled text — this
// (and the raw ```svg path below, which is a model writing arbitrary markup
// directly) both go through DOMPurify's SVG profile before ever reaching
// dangerouslySetInnerHTML.
//
// Mermaid's flowchart/sequence renderers put node/label text inside
// <foreignObject><div><span class="nodeLabel">...</span></div></foreignObject>
// (HTML embedded in the SVG, for proper text wrapping) rather than plain SVG
// <text>. Getting that to survive sanitization needs two separate things:
//   1. 'foreignobject'/div/span/p in the tag allowlist (svg profile alone
//      doesn't have foreignObject; html profile has the rest).
//   2. HTML_INTEGRATION_POINTS: { foreignobject: true } — DOMPurify's
//      namespace check force-removes ANY html-namespaced element (the div,
//      regardless of tag allowlist) whose SVG-namespace parent isn't a
//      recognized "HTML integration point", and foreignObject is NOT one of
//      DOMPurify's defaults (only MathML's annotation-xml is) — a deliberate
//      anti-mXSS default, not a bug, that has to be opted into per-tag.
// Without #2, the tag itself survives empty and every node/edge label
// silently vanishes — which is what ADD_TAGS/USE_PROFILES alone produced.
function sanitizeSvg(markup: string): string {
  return DOMPurify.sanitize(markup, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_TAGS: ['foreignobject'],
    ADD_ATTR: ['xmlns'],
    HTML_INTEGRATION_POINTS: { foreignobject: true },
  });
}

interface DiagramBlockProps {
  lang: string;
  code: string;
}

// Renders a single fenced code block from an AiOneChat message. `mermaid`
// and `svg` render live (with a download button); anything else — including
// unlabeled fences, which is where the system prompt tells the model to put
// ASCII art — falls back to plain monospace text, since there's no live
// renderer for those and there's no reason to pretend otherwise.
export default function DiagramBlock({ lang, code }: DiagramBlockProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSvg(null);
      setError(null);
    });

    if (lang === 'mermaid') {
      getMermaid()
        .then((mermaid) => mermaid.render(`mermaid-${reactId}`, code))
        .then(({ svg: rendered }) => {
          if (!cancelled) setSvg(sanitizeSvg(rendered));
        })
        .catch((err) => {
          console.warn('Mermaid render failed, falling back to raw source:', err);
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render diagram.');
        });
    } else if (lang === 'svg') {
      const sanitized = sanitizeSvg(code);
      queueMicrotask(() => {
        if (!cancelled) setSvg(sanitized);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [lang, code, reactId]);

  if (lang !== 'mermaid' && lang !== 'svg') {
    return (
      <pre className="p-2 my-1 overflow-x-auto text-xs border rounded bg-black/40 border-slate-800 text-slate-300 whitespace-pre-wrap">
        {code}
      </pre>
    );
  }

  // A malformed mermaid/svg block is a model mistake, not something the
  // reader needs a parser stack trace for — fall back to the same plain
  // source-as-text treatment as an unlabeled fence, so a syntax error never
  // surfaces as a visible broken/error box, just the diagram's intent as text.
  if (error) {
    return (
      <pre className="p-2 my-1 overflow-x-auto text-xs border rounded bg-black/40 border-slate-800 text-slate-300 whitespace-pre-wrap">
        {code}
      </pre>
    );
  }

  if (!svg) {
    return <div className="p-2 my-1 text-xs text-slate-500">Rendering diagram…</div>;
  }

  return (
    <div className="relative p-2 my-2 border rounded bg-white/5 border-slate-800">
      <div className="[&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="absolute flex gap-1 top-1 right-1">
        <button
          type="button"
          onClick={() => downloadSvg(svg, `ai-one-diagram-${Date.now()}.svg`)}
          title="Download SVG"
          className="flex items-center justify-center px-1.5 h-6 gap-1 text-[9px] font-mono uppercase transition rounded bg-black/60 text-slate-300 hover:text-white hover:bg-black/80"
        >
          <Download className="w-3 h-3" /> SVG
        </button>
        <button
          type="button"
          onClick={() => downloadSvgAsPng(svg, `ai-one-diagram-${Date.now()}.png`).catch((err) => console.error(err))}
          title="Download PNG"
          className="flex items-center justify-center px-1.5 h-6 gap-1 text-[9px] font-mono uppercase transition rounded bg-black/60 text-slate-300 hover:text-white hover:bg-black/80"
        >
          <Download className="w-3 h-3" /> PNG
        </button>
      </div>
    </div>
  );
}
