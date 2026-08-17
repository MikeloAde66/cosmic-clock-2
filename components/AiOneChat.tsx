'use client';

import React, { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Download, History as HistoryIcon, Image as ImageIcon, Mic, MicOff, Plus, SquarePen, X } from 'lucide-react';
import { useSpeechToText } from './useSpeechToText';
import AiOneMessageContent from './AiOneMessageContent';
import ChatHistoryPanel from './ChatHistoryPanel';
import ChatImagesPanel from './ChatImagesPanel';
import { downloadMarkdown, threadToMarkdown } from '@/lib/exportChat';
import { useLanguage } from '@/lib/languageContext';
import { translate, type TranslationKey } from '@/lib/translations';
import {
  createThreadId,
  deriveTitle,
  messageText,
  saveThread,
  type ChatMessage,
  type ChatThread,
  type ContentBlock,
  type DiscoveryMode,
} from '@/lib/chatHistory';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — a sane guard before base64 inflation

const MODE_KEYS: DiscoveryMode[] = ['cosmic', 'synthesis', 'quantum'];
const MODE_TRANSLATION_KEYS: Record<DiscoveryMode, { label: TranslationKey; title: TranslationKey }> = {
  cosmic: { label: 'kali.mode.cosmic.label', title: 'kali.mode.cosmic.title' },
  synthesis: { label: 'kali.mode.synthesis.label', title: 'kali.mode.synthesis.title' },
  quantum: { label: 'kali.mode.quantum.label', title: 'kali.mode.quantum.title' },
};

type WidgetView = 'chat' | 'history' | 'images';

function messageImages(content: string | ContentBlock[]): string[] {
  if (typeof content === 'string') return [];
  return content
    .filter((b): b is Extract<ContentBlock, { type: 'image' }> => b.type === 'image')
    .map((b) => `data:${b.source.media_type};base64,${b.source.data}`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AiOneChat() {
  const { language } = useLanguage();
  // A plain function, not a module-level constant — needs the current
  // language at call time, both for the initial mount and for "New chat"
  // starting a fresh thread in whatever language is selected right now.
  // Only ever computed once per thread; switching language mid-conversation
  // doesn't retroactively rewrite messages already on screen (that would
  // need a real translation call per message, not a static dictionary).
  const greetingMessage = (): ChatMessage => ({ role: 'assistant', content: translate('kali.greeting', language) });
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingMessage()]);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<DiscoveryMode>('synthesis');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<WidgetView>('chat');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Identity for the current thread — a new one is minted on mount and
  // again on "New chat"; loading a thread from History adopts its id
  // instead so re-saving updates that same entry rather than forking it.
  const threadIdRef = useRef(createThreadId());
  const createdAtRef = useRef(Date.now());

  const { isListening, toggleListening, hasSupport } = useSpeechToText((transcript) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Bring the input into view on mount — the popup card can be taller than
    // short/narrow browser windows, and the input sits near its bottom.
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Autosaves once a real exchange has happened (more than just the
  // greeting) and streaming has settled — not on every streamed token,
  // just once the assistant's turn is done.
  useEffect(() => {
    if (isStreaming || messages.length <= 1) return;
    saveThread({
      id: threadIdRef.current,
      title: deriveTitle(messages),
      mode,
      messages,
      createdAt: createdAtRef.current,
    });
  }, [messages, isStreaming, mode]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const oversized = files.find((f) => f.size > MAX_IMAGE_BYTES);
    setError(oversized ? `${oversized.name.toUpperCase()} ${translate('kali.error.fileTooLarge', language)}` : '');
    setAttachedFiles((prev) => [...prev, ...files.filter((f) => f.size <= MAX_IMAGE_BYTES)]);
    e.target.value = ''; // allow re-selecting the same file later
  };

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const startNewChat = () => {
    threadIdRef.current = createThreadId();
    createdAtRef.current = Date.now();
    setMessages([greetingMessage()]);
    setError('');
    setView('chat');
  };

  const selectThread = (thread: ChatThread) => {
    threadIdRef.current = thread.id;
    createdAtRef.current = thread.createdAt;
    setMessages(thread.messages);
    setMode(thread.mode);
    setError('');
    setView('chat');
  };

  const exportCurrentThread = () => {
    const md = threadToMarkdown({ title: deriveTitle(messages), createdAt: createdAtRef.current, messages });
    downloadMarkdown(md, `ai-one-${threadIdRef.current}.md`);
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isStreaming) return;

    setError('');

    const imageBlocks: ContentBlock[] = await Promise.all(
      attachedFiles.map(async (file) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: file.type || 'image/png',
          data: await fileToBase64(file),
        },
      }))
    );

    const userContent: string | ContentBlock[] =
      imageBlocks.length > 0 ? [...imageBlocks, { type: 'text', text: text || 'What do you see here?' }] : text;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: userContent }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setAttachedFiles([]);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/ai-one-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, mode, language }),
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
          const lastText = typeof last.content === 'string' ? last.content : '';
          updated[updated.length - 1] = { ...last, content: lastText + chunk };
          return updated;
        });
      }
    } catch {
      setError(translate('kali.error.unreachable', language));
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  if (view === 'history') {
    return <ChatHistoryPanel onBack={() => setView('chat')} onSelect={selectThread} />;
  }
  if (view === 'images') {
    return <ChatImagesPanel onBack={() => setView('chat')} />;
  }

  return (
    <div className="flex flex-col h-full min-h-[220px]">
      <div className="flex items-center justify-between gap-1 pb-2 shrink-0">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as DiscoveryMode)}
          title={translate('kali.tooltip.reasoningMode', language)}
          className="px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-black/40 border rounded border-slate-700 text-slate-200 focus:outline-none focus:border-white/50"
        >
          {MODE_KEYS.map((key) => {
            const t = MODE_TRANSLATION_KEYS[key];
            return (
              <option key={key} value={key} title={translate(t.title, language)}>
                {translate(t.label, language)}
              </option>
            );
          })}
        </select>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={startNewChat}
            title={translate('kali.tooltip.newChat', language)}
            className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            title={translate('kali.tooltip.history', language)}
            className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <HistoryIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView('images')}
            title={translate('kali.tooltip.images', language)}
            className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={exportCurrentThread}
            title={translate('kali.tooltip.export', language)}
            className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((m, idx) => {
          const text = messageText(m.content);
          const images = messageImages(m.content);
          return (
            <div key={idx} className="text-base font-mono leading-relaxed break-words text-slate-100">
              <span
                className={`mr-1.5 text-[9px] tracking-wider font-bold ${
                  m.role === 'user' ? 'uppercase text-slate-500' : 'text-white'
                }`}
              >
                {m.role === 'user' ? translate('kali.you', language) : '(Kali)'}
              </span>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                  {images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt="Attached to message"
                      className="object-cover w-16 h-16 border rounded border-slate-800"
                    />
                  ))}
                </div>
              )}
              {m.role === 'assistant' ? (
                <div className="inline">
                  <AiOneMessageContent text={text} />
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{text}</span>
              )}
              {m.role === 'assistant' && idx === messages.length - 1 && isStreaming && (
                <span className="text-white animate-pulse">▋</span>
              )}
            </div>
          );
        })}
        {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}
      </div>

      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono border rounded bg-slate-900 border-slate-800 text-slate-300"
            >
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button type="button" onClick={() => removeFile(idx)} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={sendMessage} className="flex gap-1.5 pt-2 mt-2 border-t border-slate-800">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title={translate('kali.tooltip.attachImage', language)}
          className="flex items-center justify-center w-8 h-8 transition rounded shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
        </button>

        {hasSupport && (
          <button
            type="button"
            onClick={toggleListening}
            title={translate(isListening ? 'kali.tooltip.voiceInputStop' : 'kali.tooltip.voiceInputStart', language)}
            className={`flex items-center justify-center w-8 h-8 shrink-0 rounded transition ${
              isListening
                ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={translate(isListening ? 'kali.placeholder.listening' : 'kali.placeholder.ask', language)}
          disabled={isStreaming}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          className="flex-1 min-w-0 px-2 py-1.5 text-[11px] font-mono bg-black/60 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
          className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded bg-white text-black hover:bg-neutral-200 disabled:opacity-50 whitespace-nowrap"
        >
          {isStreaming ? '…' : translate('kali.send', language)}
        </button>
      </form>
    </div>
  );
}
