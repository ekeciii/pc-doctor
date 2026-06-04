import { AlertTriangle, Info, RotateCw, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import type { ScanReport, ScoreBand } from "@/lib/types";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { ScanButton } from "./ScanButton";
import { HealthScoreRing } from "./HealthScoreRing";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { cn } from "@/lib/utils";

interface Props {
  report: ScanReport | null;
  scanning: boolean;
  fixing: boolean;
  onScan: () => void;
  onFixAll: () => void;
}

const BAND_COLOR: Record<ScoreBand, string> = {
  excellent: "var(--color-success)",
  good: "var(--color-primary)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

function HudPanel({
  glow,
  statusKey,
  rightSlot,
  children,
}: {
  glow: string;
  statusKey: TKey;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div
      className="hud-corners relative w-full max-w-2xl rounded-2xl border bg-card/55 backdrop-blur-xl px-6 pt-5 pb-8 animate-fade-in"
      style={{
        borderColor: `color-mix(in oklch, ${glow} 28%, transparent)`,
        boxShadow: `0 0 0 1px color-mix(in oklch, ${glow} 14%, transparent), 0 24px 70px -28px color-mix(in oklch, ${glow} 50%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
            style={{ background: glow, boxShadow: `0 0 8px ${glow}` }}
          />
          {t(statusKey)}
        </span>
        {rightSlot}
      </div>
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
}

export function ScoreHero({ report, scanning, fixing, onScan, onFixAll }: Props) {
  const t = useT();

  if (!report) {
    return (
      <section className="flex flex-col items-center pt-12 pb-10">
        <HudPanel glow="var(--color-primary)" statusKey="hudStandby">
          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-muted-foreground mb-6 font-mono">
            {t("appSubtitle")}
          </p>
          <ScanButton scanning={scanning} hasReport={false} onClick={onScan} />
          {!scanning && <p className="mt-6 text-sm text-muted-foreground">{t("noScanYet")}</p>}
        </HudPanel>
      </section>
    );
  }

  const { health } = report;
  const glow = BAND_COLOR[health.band];
  const fixableCount = report.cleanupTargets.length;
  const canFixAll = fixableCount > 0;
  const time = formatTime(report.generatedAt);

  return (
    <section className="flex flex-col items-center pt-10 pb-10">
      <HudPanel
        glow={glow}
        statusKey="hudStatusLabel"
        rightSlot={<span className="tabular-nums">{time}</span>}
      >
        <div className="mt-4">
          <HealthScoreRing health={health} />
        </div>

        {/* telemetri chip'leri */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {health.criticalCount === 0 && health.warningCount === 0 && health.infoCount === 0 ? (
            <Chip tone="success" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
              {t("scoreAllClear")}
            </Chip>
          ) : (
            <>
              {health.criticalCount > 0 && (
                <Chip tone="destructive" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                  {t("scoreChipCritical", { count: health.criticalCount })}
                </Chip>
              )}
              {health.warningCount > 0 && (
                <Chip tone="warning" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                  {t("scoreChipWarning", { count: health.warningCount })}
                </Chip>
              )}
              {health.infoCount > 0 && (
                <Chip tone="info" icon={<Info className="w-3.5 h-3.5" />}>
                  {t("scoreChipInfo", { count: health.infoCount })}
                </Chip>
              )}
            </>
          )}
        </div>

        {/* aksiyonlar */}
        <div className="mt-7 flex flex-col items-center gap-2.5">
          <Button
            size="lg"
            onClick={onFixAll}
            disabled={!canFixAll || fixing}
            className="gap-2.5 min-w-60"
            style={
              canFixAll && !fixing
                ? { boxShadow: `0 0 22px -4px color-mix(in oklch, ${glow} 70%, transparent)` }
                : undefined
            }
          >
            {fixing ? <Sparkles className="w-5 h-5 animate-pulse" /> : <Wand2 className="w-5 h-5" />}
            {t("fixAllCta")}
          </Button>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {canFixAll ? t("fixAllReady", { count: fixableCount }) : t("fixAllNone")}
            </span>
            <span className="text-border">·</span>
            <button
              type="button"
              onClick={onScan}
              disabled={scanning}
              className={cn(
                "inline-flex items-center gap-1.5 font-medium text-primary",
                "hover:text-primary-strong transition-colors disabled:opacity-50"
              )}
            >
              <RotateCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
              {t("rescan")}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-center w-full">
          <ScoreBreakdown breakdown={health.breakdown} />
        </div>
      </HudPanel>
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

type ChipTone = "success" | "destructive" | "warning" | "info";

function Chip({
  tone,
  icon,
  children,
}: {
  tone: ChipTone;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass: Record<ChipTone, string> = {
    success: "bg-success-soft/70 text-success-strong border-success/30",
    destructive: "bg-destructive-soft/70 text-destructive-strong border-destructive/30",
    warning: "bg-warning-soft/70 text-warning-strong border-warning/30",
    info: "bg-info-soft/70 text-info-strong border-info/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono uppercase tracking-wide border backdrop-blur-sm",
        toneClass[tone]
      )}
    >
      {icon}
      {children}
    </span>
  );
}
