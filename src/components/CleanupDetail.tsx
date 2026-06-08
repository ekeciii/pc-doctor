import { ArrowLeft, CheckCircle2, Sparkles, Trash2, Wrench } from "lucide-react";
import type { CleanupResult, CleanupTarget } from "@/lib/types";
import { useByteFmt, useT } from "@/lib/i18n";
import { CleanupPanel } from "./CleanupPanel";
import { cn } from "@/lib/utils";

interface Props {
  targets: CleanupTarget[];
  totalBytes: number;
  busy: boolean;
  lastResult: CleanupResult | null;
  onFix: (ids: string[]) => void;
  onBack: () => void;
}

export function CleanupDetail({ targets, totalBytes, busy, lastResult, onFix, onBack }: Props) {
  const t = useT();
  const fmtBytes = useByteFmt();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-1 pb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className={cn(
            "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
            "border border-border bg-card/60 backdrop-blur-sm text-foreground",
            "hover:-translate-x-0.5 hover:border-primary/40 transition-[transform,border-color]"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="shrink-0 w-10 h-10 rounded-md bg-primary-soft/70 text-primary-strong flex items-center justify-center">
          <Wrench className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground truncate">
            {t("cleanupSection")}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">{fmtBytes(totalBytes)}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {busy ? (
          <CleaningAnimation />
        ) : lastResult ? (
          <CleanedResults result={lastResult} />
        ) : (
          <CleanupPanel targets={targets} totalBytes={totalBytes} busy={busy} onFix={onFix} />
        )}
      </div>
    </div>
  );
}

/** "temizlerken özel animasyon" — süpürme efekti + uçuşan parçacıklar. */
function CleaningAnimation() {
  const t = useT();
  return (
    <div className="relative flex flex-col items-center justify-center py-16 overflow-hidden">
      {/* süpürme parlaması */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 animate-scan-sweep"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklch, var(--color-primary) 22%, transparent), transparent)",
        }}
      />
      <div className="relative">
        <span className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse-glow bg-primary" />
        <span className="relative w-20 h-20 rounded-2xl bg-primary-soft text-primary-strong flex items-center justify-center">
          <Trash2 className="w-9 h-9" />
        </span>
        {/* uçuşan parçacıklar */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Sparkles
            key={i}
            className="absolute w-3 h-3 text-primary animate-ping-ring"
            style={{
              top: `${[10, -8, 40, 60, 20][i]}%`,
              left: `${[-20, 90, 110, -16, 50][i]}%`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>
      <p className="relative mt-6 font-mono text-sm uppercase tracking-[0.24em] text-primary animate-flicker">
        {t("cleaningInProgress")}
      </p>
    </div>
  );
}

/** "temizlenen yerleri göster" — hedef hedef ne temizlendi. */
function CleanedResults({ result }: { result: CleanupResult }) {
  const t = useT();
  const fmtBytes = useByteFmt();
  const cleaned = result.perTarget.filter((r) => r.itemsRemoved > 0 || r.reclaimedBytes > 0);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 mb-4 rounded-lg bg-success-soft/60 border border-success/30 px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-success-strong shrink-0" />
        <div>
          <p className="font-semibold text-success-strong">{t("cleanupDone")}</p>
          <p className="text-sm text-muted-foreground">
            {t("reclaimed")}:{" "}
            <span className="font-mono text-foreground">{fmtBytes(result.reclaimedBytes)}</span>
          </p>
        </div>
      </div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2 font-mono">
        {t("cleanedLocationsTitle")}
      </p>
      <ul className="space-y-1.5">
        {cleaned.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("cleanedNothing")}</li>
        ) : (
          cleaned.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 animate-rise-in"
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                <span className="truncate text-sm text-foreground">{r.label}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-success-strong shrink-0">
                {fmtBytes(r.reclaimedBytes)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
