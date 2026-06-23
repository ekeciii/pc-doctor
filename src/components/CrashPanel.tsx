import { AlertTriangle, CheckCircle2, ExternalLink, FileWarning, Loader2, RotateCw, Wrench } from "lucide-react";
import type { CrashSignature } from "@/lib/types";
import { crashHistory, openReliabilityMonitor } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

interface Props {
  /** Sistem dosyası onarımı (sfc/DISM) — tekrarlayan çökmeler için standart ilk adım. */
  onRepairSystemFiles: () => void;
}

/** Çökme geçmişi kategorisi — WER sayısı + en çok çöken kaynaklar + sistem dosyası onarımı. */
export function CrashPanel({ onRepairSystemFiles }: Props) {
  const t = useT();
  const { data, loading, error, reload: load } = useAsync(crashHistory);

  const wer = data?.werCount30d ?? 0;
  const werTone = wer >= 20 ? "bad" : wer >= 5 ? "warn" : "ok";
  const sigs = data?.reliabilitySignatures ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("crashHeading")}
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onRepairSystemFiles}>
            <Wrench className="w-3.5 h-3.5" />
            {t("crashRepairCta")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openReliabilityMonitor().catch(() => {})}>
            <ExternalLink className="w-3.5 h-3.5" />
            {t("crashReliabilityCta")}
          </Button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:text-primary-strong disabled:opacity-50"
          >
            <RotateCw className={cn("w-3 h-3", loading && "animate-spin")} />
            {t("rescan")}
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("crashLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">{error}</div>
      )}

      {data && (
        <>
          {/* WER özeti */}
          <Card
            variant="default"
            className={cn(
              "flex items-center gap-3 p-4",
              werTone === "bad" ? "border-destructive/30" : werTone === "warn" ? "border-warning/30" : "border-success/30"
            )}
          >
            <span
              className={cn(
                "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
                werTone === "bad"
                  ? "bg-destructive-soft text-destructive-strong"
                  : werTone === "warn"
                    ? "bg-warning-soft text-warning-strong"
                    : "bg-success-soft text-success-strong"
              )}
            >
              {werTone === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <FileWarning className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{t("crashWerTitle")}</div>
              <div className="text-xs text-muted-foreground">
                {wer === 0 ? t("crashWerNone") : t("crashWerCount", { count: wer })}
              </div>
            </div>
          </Card>

          {/* En çok çöken kaynaklar */}
          {sigs.length > 0 ? (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground px-1">
                {t("crashTopSources")}
              </span>
              {sigs.map((sig, i) => (
                <SignatureRow key={`${sig.source}-${i}`} sig={sig} />
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                {t("crashNoSignatures")}
              </p>
            )
          )}

          <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">{t("crashFootnote")}</p>
        </>
      )}
    </div>
  );
}

function SignatureRow({ sig }: { sig: CrashSignature }) {
  const t = useT();
  const tone = sig.count >= 30 ? "bad" : sig.count >= 10 ? "warn" : "muted";
  return (
    <Card variant="default" className="flex items-center gap-3 p-3">
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
          tone === "bad"
            ? "bg-destructive-soft text-destructive-strong"
            : tone === "warn"
              ? "bg-warning-soft text-warning-strong"
              : "bg-muted text-muted-foreground"
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground truncate" title={sig.source}>
          {sig.source}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {t("crashLastSeen", { date: sig.lastOccurred })}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums",
          tone === "bad"
            ? "bg-destructive-soft text-destructive-strong"
            : tone === "warn"
              ? "bg-warning-soft text-warning-strong"
              : "bg-muted text-muted-foreground"
        )}
      >
        {t("crashCount", { count: sig.count })}
      </span>
    </Card>
  );
}
