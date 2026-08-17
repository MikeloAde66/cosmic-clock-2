'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { LANGUAGE_OPTIONS, type LanguageCode } from './languages';

export type { LanguageCode };
export { LANGUAGE_OPTIONS };

const STORAGE_KEY = 'cosmic_clock_language_v1';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Mounted once in the root layout (app/layout.tsx) so every route — the
// main single-page app under /, and standalone routes like /products —
// shares the same language state, not just whichever page happens to
// render a selector.
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGE_OPTIONS.some((o) => o.code === stored)) {
      setLanguageState(stored as LanguageCode);
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEY, lang);
  };

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
