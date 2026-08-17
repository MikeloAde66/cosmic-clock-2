// Plain data/types only — no 'use client', so this is safe to import from
// both client components (via lib/languageContext.tsx) and server routes
// (app/api/ai-one-chat/route.ts) without pulling React context machinery
// into a server bundle.
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh';

export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'zh', label: 'Mandarin', nativeName: '中文' },
];

// Full names used in Kali AI's system prompt instruction — kept separate
// from LANGUAGE_OPTIONS.label so that instruction reads as a real
// sentence ("Language preference: Spanish") rather than a raw code.
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Mandarin Chinese',
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && LANGUAGE_OPTIONS.some((o) => o.code === value);
}
