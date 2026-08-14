'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { listThreads, deleteThread, type ChatThread } from '@/lib/chatHistory';

interface ChatHistoryPanelProps {
  onBack: () => void;
  onSelect: (thread: ChatThread) => void;
}

export default function ChatHistoryPanel({ onBack, onSelect }: ChatHistoryPanelProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);

  useEffect(() => {
    queueMicrotask(() => setThreads(listThreads()));
  }, []);

  const handleDelete = (id: string) => {
    deleteThread(id);
    setThreads(listThreads());
  };

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
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">History</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {threads.length === 0 ? (
          <p className="text-xs text-slate-600">No saved conversations yet — they save automatically as you chat.</p>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 p-2 transition border rounded group border-slate-800 hover:border-slate-600 hover:bg-white/5"
            >
              <button type="button" onClick={() => onSelect(t)} className="flex-1 min-w-0 text-left">
                <div className="text-xs truncate text-slate-100">{t.title}</div>
                <div className="text-[9px] font-mono text-slate-500">{new Date(t.updatedAt).toLocaleString()}</div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                title="Delete conversation"
                className="flex items-center justify-center w-6 h-6 transition rounded shrink-0 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-black/40"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
