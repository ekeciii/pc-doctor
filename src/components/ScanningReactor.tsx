import { useT } from "@/lib/i18n";
import { CATEGORIES } from "./categoryDefs";

interface Props {
  size?: number;
}

/** Tarama sırasında gösterilen radar — dönen sweep + ping halkaları + crosshair. */
export function ScanningReactor({ size = 268 }: Props) {
  const t = useT();
  const c = size / 2;
  const rTick = c - 20;

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

  return (
    <div
      className="relative text-primary"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t("scanRadarLabel")}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-3xl opacity-30 animate-pulse-glow"
        style={{ background: "radial-gradient(circle, var(--color-primary) 0%, transparent 66%)" }}
      />

      {/* dönen radar sweep (conic) */}
      <div
        aria-hidden
        className="absolute rounded-full overflow-hidden animate-radar"
        style={{
          inset: 24,
          background:
            "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklch, var(--color-primary) 34%, transparent) 58deg, transparent 90deg)",
          maskImage: "radial-gradient(circle, transparent 22%, black 24%, black 100%)",
        }}
      />

      {/* ping halkaları */}
      {[0, 0.87, 1.74].map((d, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-full border border-primary/40 animate-ping-ring"
          style={{ inset: 40, animationDelay: `${d}s` }}
        />
      ))}

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
        {/* crosshair */}
        <line x1={c} y1={28} x2={c} y2={size - 28} stroke="currentColor" strokeWidth={1} className="opacity-20" />
        <line x1={28} y1={c} x2={size - 28} y2={c} stroke="currentColor" strokeWidth={1} className="opacity-20" />
        {/* tick'ler */}
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
        {/* sabit halkalar */}
        <circle cx={c} cy={c} r={c - 38} fill="none" stroke="var(--color-border)" strokeWidth={1} className="opacity-50" />
        <circle cx={c} cy={c} r={c - 74} fill="none" stroke="var(--color-border)" strokeWidth={1} className="opacity-40" />
      </svg>

      {/* merkez */}
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.28em] text-primary animate-flicker">
          {t("scanRadarLabel")}
        </span>
        <span className="mt-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
          {t("scanRadarHint", { count: CATEGORIES.length })}
        </span>
      </div>
    </div>
  );
}
