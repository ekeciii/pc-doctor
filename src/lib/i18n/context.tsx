import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tr, type TKey } from "./tr";
import { en } from "./en";
import { getSettings, saveSettings } from "../settings";

export type Locale = "tr" | "en";

type TParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: TKey, params?: TParams) => string;
  ready: boolean;
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

const I18nContext = createContext<I18nContextValue | null>(null);

const DICTIONARIES: Record<Locale, Record<TKey, string>> = {
  tr,
  en,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate locale from persisted settings.
    getSettings()
      .then((s) => {
        const loc = (s.locale === "en" ? "en" : "tr") as Locale;
        setLocaleState(loc);
      })
      .catch(() => {
        // Backend not ready / store missing → keep TR default.
      })
      .finally(() => setReady(true));
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      const current = await getSettings();
      await saveSettings({ ...current, locale: next });
    } catch {
      // Best-effort — UI already reflects the change.
    }
  }, []);

  const t = useCallback(
    (key: TKey, params?: TParams) => {
      const dict = DICTIONARIES[locale];
      // Fall back to TR if EN key somehow missing (shouldn't happen — TS guards).
      const template = dict[key] ?? tr[key];
      return interpolate(template, params);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t, ready }), [locale, setLocale, t, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
