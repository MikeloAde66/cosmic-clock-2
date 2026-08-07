'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Welcome. I'm Ai One — I keep company with ancient technology, quantum physics, and the mysteries stitched between them. Ask me what's on your mind.",
};

export default function AiOneChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Bring the input into view on mount — the popup card can be taller than
    // short/narrow browser windows, and the input sits near its bottom.
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setError('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

    try {
      const res = await fetch('/api/ai-one-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || 'Ai One did not respond.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
          return updated;
        });
      }
    } catch {
      setError('SIGNAL LOST. AI ONE IS UNREACHABLE.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[220px]">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((m, idx) => (
          <div key={idx} className="text-[11px] font-mono leading-relaxed break-words text-slate-100">
            <span
              className={`mr-1.5 text-[9px] uppercase tracking-wider font-bold ${
                m.role === 'user' ? 'text-slate-500' : 'text-amber-400'
              }`}
            >
              {m.role === 'user' ? 'you' : 'ai one'}
            </span>
            {m.content}
            {m.role === 'assistant' && idx === messages.length - 1 && isStreaming && (
              <span className="text-amber-500 animate-pulse">▋</span>
            )}
          </div>
        ))}
        {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}
      </div>

      <form ref={formRef} onSubmit={sendMessage} className="flex gap-1.5 pt-2 mt-2 border-t border-slate-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ASK AI ONE..."
          disabled={isStreaming}
          className="flex-1 min-w-0 px-2 py-1.5 text-[11px] font-mono bg-black/60 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-amber-500/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap"
        >
          {isStreaming ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
