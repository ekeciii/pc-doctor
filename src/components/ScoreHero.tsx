import { AlertTriangle, Info, RotateCw, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import type { ScanReport } from "@/lib/types";
import { useT } from "@/lib/i18n";
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

export function ScoreHero({ report, scanning, fixing, onScan, onFixAll }: Props) {
  const t = useT();

  // Tarama öncesi — idle hero.
  if (!report) {
    return (
      <section className="flex flex-col items-center pt-14 pb-12">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground mb-5">
          {t("appSubtitle")}
        </p>
        <ScanButton scanning={scanning} hasReport={false} onClick={onScan} />
        {!scanning && <p className="mt-5 text-sm text-muted-foreground">{t("noScanYet")}</p>}
      </section>
    );
  }

  const { health } = report;
  const fixableCount = report.cleanupTargets.length;
  const canFixAll = fixableCount > 0;

  return (
    <section className="flex flex-col items-center pt-10 pb-10">
      <HealthScoreRing health={health} />

      {/* Sayım chip'leri */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {health.criticalCount === 0 &&
        health.warningCount === 0 &&
        health.infoCount === 0 ? (
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

      {/* Aksiyonlar */}
      <div className="mt-7 flex flex-col items-center gap-2.5">
        <Button
          size="lg"
          onClick={onFixAll}
          disabled={!canFixAll || fixing}
          className="shadow-lg hover:shadow-xl gap-2.5 min-w-56"
        >
          {fixing ? (
            <Sparkles className="w-5 h-5 animate-pulse" />
          ) : (
            <Wand2 className="w-5 h-5" />
          )}
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
    </section>
  );
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
    success: "bg-success-soft text-success-strong",
    destructive: "bg-destructive-soft text-destructive-strong",
    warning: "bg-warning-soft text-warning-strong",
    info: "bg-info-soft text-info-strong",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
        toneClass[tone]
      )}
    >
      {icon}
      {children}
    </span>
  );
}
