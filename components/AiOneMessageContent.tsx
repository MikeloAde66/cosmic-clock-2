'use client';

import React from 'react';
import Markdown, { type Components } from 'react-markdown';
import DiagramBlock from './DiagramBlock';

// Fenced code blocks always come through as <pre><code className="language-x">
// regardless of react-markdown version — overriding `pre` (not `code`) is
// what lets a single component see both the language and the code text
// together, and lets ASCII-art fences with no language tag still render as
// a block instead of falling through to inline-code styling.
function PreOverride({ children }: { children?: React.ReactNode }) {
  const child = React.isValidElement<{ className?: string; children?: React.ReactNode }>(children)
    ? children
    : null;
  const className = child?.props.className ?? '';
  const lang = /language-(\w+)/.exec(className)?.[1] ?? '';
  const code = String(child?.props.children ?? '').replace(/\n$/, '');
  return <DiagramBlock lang={lang} code={code} />;
}

// No @tailwindcss/typography plugin in this project — these are explicit
// per-element overrides rather than a `prose` class, kept minimal and
// consistent with the rest of the chat's styling (text-sm, slate-100,
// cyan accents, no yellow/amber per this app's own design rule).
const COMPONENTS: Components = {
  pre: PreOverride,
  code: (props) => <code className="px-1 py-0.5 rounded bg-black/40 text-cyan-300" {...props} />,
  p: (props) => <p className="my-1.5 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="my-1.5 ml-4 space-y-0.5 list-disc" {...props} />,
  ol: (props) => <ol className="my-1.5 ml-4 space-y-0.5 list-decimal" {...props} />,
  strong: (props) => <strong className="font-bold text-white" {...props} />,
  a: (props) => <a className="underline text-cyan-400 hover:text-cyan-300" target="_blank" rel="noopener noreferrer" {...props} />,
  blockquote: (props) => <blockquote className="pl-3 my-1.5 border-l-2 border-cyan-500/30 text-slate-300" {...props} />,
  h1: (props) => <h3 className="mt-2 mb-1 text-sm font-bold text-white" {...props} />,
  h2: (props) => <h3 className="mt-2 mb-1 text-sm font-bold text-white" {...props} />,
  h3: (props) => <h3 className="mt-2 mb-1 text-sm font-bold text-white" {...props} />,
};

export default function AiOneMessageContent({ text }: { text: string }) {
  return <Markdown components={COMPONENTS}>{text}</Markdown>;
}
