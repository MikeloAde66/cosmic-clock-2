'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { listThreads, extractDiagramsFromThreads, type ExtractedDiagram } from '@/lib/chatHistory';
import DiagramBlock from './DiagramBlock';

export default function ChatImagesPanel({ onBack }: { onBack: () => void }) {
  const [diagrams, setDiagrams] = useState<ExtractedDiagram[]>([]);

  useEffect(() => {
    queueMicrotask(() => setDiagrams(extractDiagramsFromThreads(listThreads())));
  }, []);

  return (
    <div className="flex flex-col h-full min-h-[220px]">
      <div className="flex items-center gap-2 pb-2 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Images</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {diagrams.length === 0 ? (
          <p className="text-xs text-slate-600">
            No diagrams yet — ask Ai One for a Mermaid or SVG diagram and it&apos;ll show up here once the conversation saves.
          </p>
        ) : (
          diagrams.map((d) => (
            <div key={d.key} className="space-y-1">
              <div className="text-[9px] font-mono uppercase tracking-wider truncate text-slate-500">{d.threadTitle}</div>
              <DiagramBlock lang={d.lang} code={d.code} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
