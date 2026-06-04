import { useMemo } from "react";
import { useI18n } from "./context";

function localeTag(locale: "tr" | "en"): string {
  return locale === "tr" ? "tr-TR" : "en-US";
}

export function useNumberFmt(): Intl.NumberFormat {
  const { locale } = useI18n();
  return useMemo(() => new Intl.NumberFormat(localeTag(locale)), [locale]);
}

export function useDateFmt(): Intl.DateTimeFormat {
  const { locale } = useI18n();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag(locale), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  );
}

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * Locale-aware byte formatter. Mirrors the `formatBytes` helper in lib/utils
 * but respects the current locale's thousand/decimal separators.
 */
export function useByteFmt(): (bytes: number) => string {
  const { locale } = useI18n();
  return useMemo(() => {
    const nf = new Intl.NumberFormat(localeTag(locale), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return (b: number) => {
      if (!isFinite(b) || b < 0) return "0 B";
      let i = 0;
      let v = b;
      while (v >= 1024 && i < UNITS.length - 1) {
        v /= 1024;
        i++;
      }
      return `${nf.format(v < 10 && i > 0 ? Number(v.toFixed(1)) : Math.round(v))} ${UNITS[i]}`;
    };
  }, [locale]);
}
