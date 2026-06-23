import { useEffect, useState } from "react";
import { useI18n } from "./i18n";

/**
 * Locale-aware duration formatting + a shared reduced-motion hook.
 *
 * Replaces the hardcoded Turkish `"${m} dk ${sec} sn"` formatters that were
 * scattered across the chkdsk/defender dialogs (they rendered literal Turkish
 * units in the EN locale).
 */

/** Split a whole-second duration into minute/second components. */
function splitMinSec(totalSeconds: number): { m: number; sec: number } {
  const s = Math.max(0, Math.floor(totalSeconds));
  return { m: Math.floor(s / 60), sec: s % 60 };
}

/**
 * Returns a locale-aware formatter producing e.g.
 *   TR → "5 dk 3 sn"
 *   EN → "5 min 3 sec"
 *
 * Uses the in-app i18n locale (NOT the OS locale), via the same dictionary the
 * rest of the UI relies on. Add/maintain the unit keys in tr.ts AND en.ts.
 */
export function useDuration(): (totalSeconds: number) => string {
  const { t } = useI18n();
  return (totalSeconds: number) => {
    const { m, sec } = splitMinSec(totalSeconds);
    return t("durationMinSec", { m, sec });
  };
}

/**
 * Shared reduced-motion hook. Mirrors the implementation that previously lived
 * privately inside HealthScoreRing so heavy HUD animations can be gated
 * consistently across the app.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}
