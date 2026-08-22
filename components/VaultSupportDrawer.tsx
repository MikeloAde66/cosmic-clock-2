'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { TICKET_CATEGORIES, type TicketCategory } from '@/lib/supportTicketCategories';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Renders inside CosmicVaultAuth's selectedCategory === 'SUPPORT' branch —
// same non-track-pack pattern as MERCH. Two independent pieces: a quick-
// help chat (app/api/support/assistant, a lightweight Sonnet endpoint,
// distinct from the main Kali research assistant) offered first, and a
// ticket form (app/api/support/tickets) below it for anything the
// assistant can't resolve.
export default function VaultSupportDrawer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState('');

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);
    setChatError('');

    try {
      const res = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || 'The support assistant did not respond.');
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
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'The support assistant is unreachable right now.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const [category, setCategory] = useState<TicketCategory>(TICKET_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !email.trim()) {
      setSubmitError('Description and email are required.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, description: description.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        setSubmitError(await res.text());
        return;
      }
      const data = await res.json();
      setSubmittedId(data.ticket.id as string);
      setDescription('');
    } catch {
      setSubmitError('Failed to submit — check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400">Quick Help</h3>
        <div className="border rounded-xl border-slate-800 bg-slate-950/60">
          <div className="p-4 space-y-3 overflow-y-auto max-h-72">
            {messages.length === 0 && (
              <p className="text-xs text-slate-500">
                Ask about signing in, Vault access, playback issues, or billing — instant answers before you need a
                ticket.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-xs whitespace-pre-wrap ${m.role === 'user' ? 'text-white' : 'text-slate-300'}`}
              >
                <span className="font-mono uppercase tracking-wider text-slate-600">
                  {m.role === 'user' ? 'You' : 'Support'}
                </span>
                <p className="mt-0.5">{m.content || (isStreaming && i === messages.length - 1 ? '…' : '')}</p>
              </div>
            ))}
            {chatError && <p className="text-xs text-red-400">{chatError}</p>}
          </div>
          <form onSubmit={sendMessage} className="flex items-center gap-2 p-3 border-t border-slate-800">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 p-2 text-xs bg-black/40 border rounded border-slate-800 text-slate-100 outline-none focus:border-white/50"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="flex items-center justify-center w-8 h-8 text-black bg-white rounded disabled:opacity-40 hover:bg-neutral-200 transition"
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400">Submit a Ticket</h3>
        {submittedId ? (
          <div className="p-4 text-xs border rounded-xl border-slate-800 bg-slate-950/60 text-slate-300">
            Ticket submitted — we&apos;ll follow up at the email you provided.
            <button onClick={() => setSubmittedId(null)} className="block mt-2 text-white underline">
              Submit another
            </button>
          </div>
        ) : (
          <form onSubmit={submitTicket} className="p-4 space-y-3 border rounded-xl border-slate-800 bg-slate-950/60">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full p-2.5 text-xs bg-black/40 border rounded border-slate-800 text-slate-100 outline-none focus:border-white/50"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State what's happening…"
              rows={4}
              className="w-full p-2.5 text-xs bg-black/40 border rounded border-slate-800 text-slate-100 outline-none focus:border-white/50 resize-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full p-2.5 text-xs bg-black/40 border rounded border-slate-800 text-slate-100 outline-none focus:border-white/50"
            />
            {submitError && <p className="text-xs text-red-400">{submitError}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-40 transition"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Ticket'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
