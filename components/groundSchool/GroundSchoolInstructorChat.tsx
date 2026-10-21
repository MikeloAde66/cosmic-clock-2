'use client';

import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import AiOneMessageContent from '../AiOneMessageContent';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

// A deliberately small, purpose-built Q&A box — not the full AiOneChat
// widget (its cosmic/quantum/synthesis mode selector, image attachments,
// and speech-to-text don't belong on a drone-terminology lesson page).
// Hits the same /api/ai-one-chat route with groundSchool: true, which
// appends GROUND_SCHOOL_ADDENDUM server-side — same mechanism as
// voiceMode, just a different persona slice of the same Kali.
export default function GroundSchoolInstructorChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const apiMessages = [...turns, { role: 'user' as const, text }].map((t) => ({ role: t.role, content: t.text }));
    setTurns((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: '' }]);
    setInput('');
    setIsStreaming(true);
    setError('');

    try {
      const res = await fetch('/api/ai-one-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, groundSchool: true }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || 'Instructor did not respond.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTurns((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, text: last.text + chunk };
          return updated;
        });
      }
    } catch {
      setError("Couldn't reach the instructor — try again in a moment.");
      setTurns((prev) => prev.slice(0, -2));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden border rounded-xl border-purple-500/30 bg-slate-950/60">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-500/20 text-purple-300">
        <Bot className="w-4 h-4" />
        <span className="text-xs font-bold tracking-wide uppercase">Ask Your Instructor</span>
      </div>

      <div className="flex flex-col gap-3 p-4 overflow-y-auto max-h-80 min-h-[88px]">
        {turns.length === 0 && (
          <p className="text-xs text-slate-500">
            Ask about anything from this course — &quot;what&apos;s the difference between loiter and RTL?&quot; or
            &quot;do I actually need a license to fly for fun?&quot;
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                t.role === 'user' ? 'bg-slate-800 text-slate-100' : 'bg-purple-500/10 text-slate-100'
              }`}
            >
              {t.role === 'assistant' ? <AiOneMessageContent text={t.text || '…'} /> : t.text}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-purple-500/20">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about terminology, flight modes, or FAA rules…"
          className="flex-1 px-3 py-2 text-sm bg-transparent border rounded-lg outline-none border-slate-700 text-slate-100 placeholder-slate-600 focus:border-purple-500"
        />
        <button
          onClick={send}
          disabled={isStreaming || !input.trim()}
          aria-label="Send"
          className="flex items-center justify-center w-9 h-9 text-white transition rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
