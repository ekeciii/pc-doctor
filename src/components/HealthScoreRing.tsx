import { useEffect, useRef, useState } from "react";
import type { HealthScore, ScoreBand } from "@/lib/types";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";
import { usePrefersReducedMotion } from "@/lib/duration";
import { cn } from "@/lib/utils";

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

function useCountUp(target: number, reduced: boolean, durationMs = 1300): number {
  const [val, setVal] = useState(0);
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
  size?: number;
}

export function HealthScoreRing({ health, size = 268 }: Props) {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const displayed = useCountUp(health.score, reduced);
  const color = BAND_COLOR[health.band];

  const c = size / 2;
  const rOuter = c - 9; // dönen segmentli dış halka
  const rTick = c - 20; // tick dış yarıçap
  const stroke = 14;
  const r = c - 42; // ana değer yayı
  const rInner = r - 20; // ters dönen iç halka
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - displayed / 100);

  // değer yayı uç noktası (top'tan başlar, -90°)
  const headAngle = (-90 + (displayed / 100) * 360) * (Math.PI / 180);
  const hx = c + r * Math.cos(headAngle);
  const hy = c + r * Math.sin(headAngle);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 - 90) * (Math.PI / 180);
    const major = i % 5 === 0;
    const inner = rTick - (major ? 9 : 5);
    return {
      x1: c + rTick * Math.cos(a),
      y1: c + rTick * Math.sin(a),
      x2: c + inner * Math.cos(a),
      y2: c + inner * Math.sin(a),
      major,
    };
  });

  const spinOrigin = { transformOrigin: `${c}px ${c}px` } as const;

  return (
    <div
      className="relative"
      style={{ width: size, height: size, color }}
      role="img"
      aria-label={`${t("scoreLabel")}: ${health.score} / 100 — ${t(BAND_VERDICT[health.band])}`}
    >
      {/* reaktör halesi */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full blur-3xl opacity-30",
          !reduced && "animate-pulse-glow"
        )}
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 66%)` }}
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
        {/* dönen segmentli dış halka */}
        <circle
          cx={c}
          cy={c}
          r={rOuter}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray="2 9"
          strokeLinecap="round"
          className={cn("opacity-40", !reduced && "animate-spin-slow")}
          style={spinOrigin}
        />

        {/* tick'ler (sabit) */}
        <g>
          {ticks.map((tk, i) => (
            <line
              key={i}
              x1={tk.x1}
              y1={tk.y1}
              x2={tk.x2}
              y2={tk.y2}
              stroke={tk.major ? "currentColor" : "var(--color-muted-foreground)"}
              strokeWidth={tk.major ? 1.6 : 1}
              className={tk.major ? "opacity-55" : "opacity-25"}
            />
          ))}
        </g>

        {/* ters dönen iç halka */}
        <circle
          cx={c}
          cy={c}
          r={rInner}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="1 14"
          className={cn("opacity-60", !reduced && "animate-spin-rev")}
          style={spinOrigin}
        />

        {/* iz */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
          className="opacity-60"
        />

        {/* değer yayı */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ filter: "drop-shadow(0 0 9px currentColor)" }}
        />

        {/* parlayan uç nokta */}
        {displayed > 1 && (
          <circle
            cx={hx}
            cy={hy}
            r={5.5}
            fill="currentColor"
            style={{ filter: "drop-shadow(0 0 8px currentColor)" }}
          />
        )}
      </svg>

      {/* merkez okuma */}
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <div className="flex items-start font-mono font-semibold tabular-nums leading-none text-foreground">
          <span
            style={{
              fontSize: size * 0.3,
              textShadow: `0 0 22px color-mix(in oklch, ${color} 55%, transparent)`,
            }}
          >
            {displayed}
          </span>
          <span className="mt-1.5 text-muted-foreground" style={{ fontSize: size * 0.082 }}>
            /100
          </span>
        </div>
        <div
          className="mt-1.5 font-display font-semibold tracking-tight"
          style={{ color, fontSize: size * 0.07 }}
        >
          {t(BAND_VERDICT[health.band])}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
          {t("scoreLabel")}
        </div>
      </div>
    </div>
  );
}
