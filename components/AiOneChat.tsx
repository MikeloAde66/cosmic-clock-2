'use client';

import React, { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  History as HistoryIcon,
  Image as ImageIcon,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Plus,
  Printer,
  SquarePen,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
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
import { fetchWikiSummary } from '@/lib/wiki';

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

interface AiOneChatProps {
  // Set by a caller elsewhere on the page (e.g. StarTrackerView's "Ask Kali"
  // tooltip action, routed through KaliOracleView) that wants to hand this
  // chat a real query built from live data. Prefills the input and focuses
  // it — deliberately does NOT auto-submit, so a query built from a click
  // never fires an API call without the user reviewing/confirming it first.
  // A token (not just the text) so asking the same question twice in a row
  // still re-triggers the effect.
  prefillQuery?: { text: string; token: number } | null;
}

export default function AiOneChat({ prefillQuery }: AiOneChatProps = {}) {
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
  // Maximize toggle — fixed-position overlay over whatever this is mounted
  // inside (KaliOracleView's side columns are only 260px, too narrow for
  // comfortably reading long replies), rather than a layout change that
  // would need every parent container to cooperate.
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<WidgetView>('chat');
  // Index of the message currently being read aloud via window.speechSynthesis
  // — null when nothing is speaking. Only one message speaks at a time.
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const lastPrefillToken = useRef<number | null>(null);
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

  useEffect(() => {
    if (!prefillQuery || prefillQuery.token === lastPrefillToken.current) return;
    lastPrefillToken.current = prefillQuery.token;
    setInput(prefillQuery.text);
    setIsExpanded(true);
    chatInputRef.current?.focus();
  }, [prefillQuery]);

  // Speech never outlives this component — cancel on unmount so switching
  // away from Kali (or navigating elsewhere) doesn't leave her talking.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Toggle: clicking the speaker on the message already speaking stops it;
  // clicking a different one cancels that and starts the new one instead.
  const toggleSpeak = (idx: number, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Lower, deliberate terminal tone, matching Kali's grounded/analytical
    // persona rather than a default chipper assistant voice.
    utterance.pitch = 0.85;
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((v) => v.name.includes('Google UK English Female') || v.name.includes('Samantha')) ??
      voices[0];

    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);

    window.speechSynthesis.speak(utterance);
    setSpeakingIdx(idx);
  };

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

  // Prints just the transcript in a clean, minimal document — not
  // window.print() on the live page, which would try to print the 3D
  // canvas/starfield/HUD chrome this is embedded in along with it. Reuses
  // the exact same real transcript text as the Download/export button
  // (threadToMarkdown), just rendered as plain preformatted text rather
  // than downloaded as a .md file.
  const printCurrentThread = () => {
    const title = deriveTitle(messages);
    const md = threadToMarkdown({ title, createdAt: createdAtRef.current, messages });
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta charset="utf-8" />
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap;
         max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #111; }
  h1 { font-size: 1.1rem; }
</style>
</head>
<body>${md.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isStreaming) return;

    setError('');
    setIsExpanded(true); // auto-expand into the full reading view the moment a reply starts generating

    // What actually shows in the transcript vs. what's sent to the model —
    // normally identical, but /wiki keeps the visible bubble as the raw
    // command while the API sees the fetched summary as context instead.
    let displayContent: string | ContentBlock[] = text;
    let apiContent: string | ContentBlock[] = text;

    // /wiki <topic> <optional instructions> — looks up a Wikipedia summary
    // and hands it to Kali as context so she formulates the actual reply in
    // her own voice, rather than the raw extract bypassing her entirely.
    // The query is the main title only: everything up to a dash/colon that's
    // clearly acting as a separator (surrounded by whitespace), not a
    // hyphen inside the title itself (e.g. "X-ray", "COVID-19" stay whole).
    const wikiMatch = /^\/wiki\s+(.+)/i.exec(text);
    if (wikiMatch) {
      const rest = wikiMatch[1].trim();
      const split = /^(.*?)(?:\s+[-–—]\s+|:\s+)(.+)$/.exec(rest);
      const topic = (split ? split[1] : rest).trim();
      const instructions = split ? split[2].trim() : '';

      const summary = topic ? await fetchWikiSummary(topic) : null;

      if (!summary) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: `No Wikipedia summary found for "${topic}".` },
        ]);
        setInput('');
        setAttachedFiles([]);
        return;
      }

      apiContent = `[Wikipedia summary for "${summary.title}"]\n${summary.extract}\n\n${
        instructions || `Give a complete, well-formed answer about ${summary.title} using the summary above.`
      }`;
    } else if (attachedFiles.length > 0) {
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
      const withImages: ContentBlock[] = [...imageBlocks, { type: 'text', text: text || 'What do you see here?' }];
      displayContent = withImages;
      apiContent = withImages;
    }

    const displayMessages: ChatMessage[] = [...messages, { role: 'user', content: displayContent }];
    const apiMessages: ChatMessage[] = [...messages, { role: 'user', content: apiContent }];
    setMessages([...displayMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setAttachedFiles([]);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/ai-one-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode, language }),
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

  // display: contents when not expanded means this wrapper is invisible to
  // layout — every parent that already embeds AiOneChat keeps working
  // exactly as before. When expanded, it becomes a real fixed overlay so
  // the panel gets real screen height/width regardless of how narrow its
  // normal host container is (e.g. KaliOracleView's 260px side columns).
  const chatPanel = (
    <div
      className={
        isExpanded
          ? 'flex flex-col w-full max-w-4xl h-[85vh] p-4 border shadow-2xl rounded-xl bg-[#0a0a0c] border-slate-800'
          : 'flex flex-col h-full min-h-[220px]'
      }
    >
      <div className="flex items-center justify-between gap-1 pb-2 shrink-0">
        <div className="flex items-center gap-1">
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
          {isExpanded ? (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wide transition rounded text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <Minimize2 className="w-3 h-3" />
              Back to Kali
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              title="Expand for easier reading"
              className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

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
          <button
            type="button"
            onClick={printCurrentThread}
            title="Print transcript"
            className="flex items-center justify-center w-6 h-6 transition rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
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
              {m.role === 'assistant' && text && !(idx === messages.length - 1 && isStreaming) && (
                <button
                  type="button"
                  onClick={() => toggleSpeak(idx, text)}
                  title={speakingIdx === idx ? 'Stop reading aloud' : 'Read aloud'}
                  className={`inline-flex items-center justify-center w-5 h-5 mr-1.5 -mt-0.5 align-middle transition rounded ${
                    speakingIdx === idx
                      ? 'text-white bg-slate-800'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {speakingIdx === idx ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
              )}
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

      {/* sticky bottom-0 — both real call sites (KaliOracleView,
          KaliSection) sit inside a container that scrolls on mobile (the
          avatar + telemetry content can be taller than the viewport), so
          without this the prompt input required scrolling all the way
          down to reach every time instead of staying reachable while the
          conversation above it scrolls. position: sticky anchors to the
          nearest scrolling ancestor automatically, no extra wiring needed.
          Needs its own background (position: sticky content still needs
          a backdrop) - #07090E matches KaliOracleView exactly and is
          close enough to KaliSection's inherited ambient background to
          read as seamless there too. safe-area-inset-bottom keeps the
          input clear of the iOS home-indicator/gesture-bar area. */}
      <form
        ref={formRef}
        onSubmit={sendMessage}
        className="sticky bottom-0 z-10 flex gap-1.5 pt-2 mt-2 border-t border-slate-800 bg-[#07090E]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
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
          ref={chatInputRef}
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

  // Portal to document.body when expanded — CosmicCanvas's 3D-transformed
  // layers create a new containing block for position:fixed descendants
  // (a documented CSS behavior: a transformed ancestor makes fixed
  // children position relative to it, not the viewport), which made a
  // plain fixed overlay render underneath the real app header instead of
  // above it. Escaping to a portal sidesteps that entirely. Not expanded:
  // render inline exactly as before, no portal, no behavior change.
  if (isExpanded && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm sm:p-6">
        {chatPanel}
      </div>,
      document.body
    );
  }

  return chatPanel;
}
