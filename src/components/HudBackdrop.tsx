import type { ScoreBand } from "@/lib/types";

const BAND_GLOW: Record<ScoreBand, string> = {
  excellent: "var(--color-success)",
  good: "var(--color-primary)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

/**
 * Sci-fi komuta merkezi atmosferi — sabit, içeriğin arkasında.
 * Skora-tepkili üst glow + teknik ızgara + tarama çizgisi + derinlik vignette.
 */
export function HudBackdrop({ band }: { band?: ScoreBand }) {
  const glow = band ? BAND_GLOW[band] : "var(--color-primary)";
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* skora-tepkili üst glow (band değişince 1sn'de geçiş) */}
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(ellipse 72% 56% at 50% -4%, color-mix(in oklch, ${glow} 24%, transparent), transparent 70%)`,
        }}
      />
      {/* teknik ızgara */}
      <div className="absolute inset-0 hud-grid opacity-[0.13] dark:opacity-[0.16]" />
      {/* yatay tarama çizgisi */}
      <div
        className="absolute inset-x-0 top-0 h-px animate-scan-sweep"
        style={{
          background: `linear-gradient(90deg, transparent, ${glow}, transparent)`,
          boxShadow: `0 0 14px ${glow}`,
        }}
      />
      {/* derinlik vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 92% 82% at 50% 48%, transparent 56%, color-mix(in oklch, var(--color-background) 55%, black) 100%)",
        }}
      />
    </div>
  );
}
