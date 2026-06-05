import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Locale } from "@/i18n/translations";

const STORAGE_KEY = "vohitra.locale";
const DEFAULT_LOCALE: Locale = "fr";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function resolve(dict: any, key: string): string | undefined {
  return key.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), dict);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage on mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "fr" || stored === "mg") setLocaleState(stored);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string) => {
      const val = resolve(translations[locale], key) ?? resolve(translations[DEFAULT_LOCALE], key);
      return typeof val === "string" ? val : key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fail-safe fallback so components don't crash if used outside provider during SSR
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string) => {
        const val = resolve(translations[DEFAULT_LOCALE], key);
        return typeof val === "string" ? val : key;
      },
    };
  }
  return ctx;
}
