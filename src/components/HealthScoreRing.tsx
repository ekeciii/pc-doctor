import { useEffect, useRef, useState } from "react";
import type { HealthScore, ScoreBand } from "@/lib/types";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";

/** Band → renk token'ı (CSS var). Yeşil=mükemmel, petrol=iyi, amber=dikkat, kırmızı=kritik. */
const BAND_COLOR: Record<ScoreBand, string> = {
  excellent: "var(--color-success)",
  good: "var(--color-primary)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

const BAND_VERDICT: Record<ScoreBand, TKey> = {
  excellent: "scoreVerdictExcellent",
  good: "scoreVerdictGood",
  warning: "scoreVerdictWarning",
  critical: "scoreVerdictCritical",
};

function usePrefersReducedMotion(): boolean {
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

/** 0 → target sayaç (easeOutCubic). reduced-motion'da anında target. */
function useCountUp(target: number, durationMs = 1100): number {
  const [val, setVal] = useState(0);
  const reduced = usePrefersReducedMotion();
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduced) {
      setVal(target);
      return;
    }
    startRef.current = null;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);
  return val;
}

interface Props {
  health: HealthScore;
  /** px — halka çapı. */
  size?: number;
}

export function HealthScoreRing({ health, size = 240 }: Props) {
  const t = useT();
  const displayed = useCountUp(health.score);
  const color = BAND_COLOR[health.band];

  const stroke = 16;
  const r = (size - stroke) / 2 - 6; // 6px nefes payı (glow taşması)
  const c = 2 * Math.PI * r;
  const offset = c * (1 - displayed / 100);
  const center = size / 2;

  return (
    <div
      className="relative animate-breathe"
      style={{ width: size, height: size, color }}
      role="img"
      aria-label={`${t("scoreLabel")}: ${health.score} / 100 — ${t(BAND_VERDICT[health.band])}`}
    >
      {/* Yumuşak dış hale — derinlik */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-2xl opacity-25 transition-opacity"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 68%)` }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative -rotate-90"
      >
        {/* İz */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
          className="opacity-70"
        />
        {/* İnce iç hairline — enstrüman hissi */}
        <circle
          cx={center}
          cy={center}
          r={r - stroke / 2 - 3}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
          className="opacity-60"
        />
        {/* Değer yayı */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 7px currentColor)" }}
        />
      </svg>

      {/* Merkez okuma */}
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <div className="flex items-start font-mono font-semibold tabular-nums leading-none text-foreground">
          <span style={{ fontSize: size * 0.3 }}>{displayed}</span>
          <span className="mt-1 text-muted-foreground" style={{ fontSize: size * 0.085 }}>
            /100
          </span>
        </div>
        <div
          className="mt-2 font-display font-semibold tracking-tight"
          style={{ color, fontSize: size * 0.072 }}
        >
          {t(BAND_VERDICT[health.band])}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("scoreLabel")}
        </div>
      </div>
    </div>
  );
}
