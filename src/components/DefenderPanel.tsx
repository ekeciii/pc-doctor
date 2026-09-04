import { Bug, CheckCircle2, Loader2, RotateCw, ShieldCheck, ShieldX, XCircle } from "lucide-react";
import type { ThreatDetection } from "@/lib/types";
import { defenderOverview } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

interface Props {
  /** Defender Hızlı Tarama'yı başlatır (App seviyesindeki onay + DefenderScanDialog). */
  onQuickScan: () => void;
}

/** Virüs/Defender kategorisi — koruma durum panosu + son tehditler + hızlı tarama. */
export function DefenderPanel({ onQuickScan }: Props) {
  const t = useT();
  const { data, loading, error, reload: load } = useAsync(defenderOverview);

  const s = data?.status ?? null;
  const threats = data?.recentThreats ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("defenderHeading")}
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onQuickScan}>
            <ShieldCheck className="w-3.5 h-3.5" />
            {t("defenderQuickScan")}
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
          {t("defenderLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {error}
        </div>
      )}

      {data && !data.available && !loading && (
        <Card variant="default" className="p-4 text-sm text-muted-foreground">
          {t("defenderUnavailable")}
        </Card>
      )}

      {s && (
        <>
          {/* koruma durumu ızgarası */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatusTile label={t("defenderRtProtection")} on={s.realTimeProtection} critical />
            <StatusTile label={t("defenderTamper")} on={s.tamperProtection} />
            <StatusTile label={t("defenderAntivirus")} on={s.antivirusEnabled} critical />
            <StatusTile label={t("defenderBehavior")} on={s.behaviorMonitor} />
          </div>

          {/* yaş metrikleri */}
          <div className="grid grid-cols-3 gap-2.5">
            <AgeTile
              label={t("defenderSignatureAge")}
              days={s.signatureAgeDays}
              warnAt={7}
              badAt={30}
            />
            <AgeTile
              label={t("defenderLastQuick")}
              days={s.lastQuickScanDays}
              warnAt={14}
              badAt={30}
            />
            <AgeTile
              label={t("defenderLastFull")}
              days={s.lastFullScanDays}
              warnAt={30}
              badAt={90}
            />
          </div>

          {/* son tehditler */}
          {threats.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
                <Bug className="w-3.5 h-3.5" />
                {t("defenderRecentThreats", { count: threats.length })}
              </div>
              {threats.slice(0, 10).map((th, i) => (
                <ThreatRow key={i} threat={th} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              {t("defenderNoThreats")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatusTile({
  label,
  on,
  critical = false,
}: {
  label: string;
  on: boolean;
  critical?: boolean;
}) {
  const t = useT();
  return (
    <Card
      variant="default"
      className={cn(
        "flex items-center gap-2.5 p-3",
        on ? "border-success/30" : critical ? "border-destructive/40" : "border-warning/40"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
          on
            ? "bg-success-soft text-success-strong"
            : critical
              ? "bg-destructive-soft text-destructive-strong"
              : "bg-warning-soft text-warning-strong"
        )}
      >
        {on ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div
          className={cn(
            "text-sm font-semibold",
            on
              ? "text-success-strong"
              : critical
                ? "text-destructive-strong"
                : "text-warning-strong"
          )}
        >
          {on ? t("defenderOn") : t("defenderOff")}
        </div>
      </div>
    </Card>
  );
}

function AgeTile({
  label,
  days,
  warnAt,
  badAt,
}: {
  label: string;
  days: number | null;
  warnAt: number;
  badAt: number;
}) {
  const t = useT();
  const tone = days == null ? "muted" : days >= badAt ? "bad" : days >= warnAt ? "warn" : "ok";
  const toneClass =
    tone === "bad"
      ? "text-destructive-strong"
      : tone === "warn"
        ? "text-warning-strong"
        : tone === "ok"
          ? "text-foreground"
          : "text-muted-foreground";
  return (
    <Card variant="default" className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className={cn("text-sm font-semibold tabular-nums", toneClass)}>
        {days == null ? "—" : t("defenderDaysAgo", { days })}
      </div>
    </Card>
  );
}

const THREAT_TONE: Record<string, string> = {
  active: "bg-destructive-soft text-destructive-strong",
  detected: "bg-destructive-soft text-destructive-strong",
  allowed: "bg-warning-soft text-warning-strong",
  quarantined: "bg-success-soft text-success-strong",
  removed: "bg-success-soft text-success-strong",
  cleaned: "bg-success-soft text-success-strong",
  blocked: "bg-success-soft text-success-strong",
};

function ThreatRow({ threat }: { threat: ThreatDetection }) {
  const tone = THREAT_TONE[threat.status.toLowerCase()] ?? "bg-muted text-muted-foreground";
  const handled = ["quarantined", "removed", "cleaned", "blocked"].includes(
    threat.status.toLowerCase()
  );
  return (
    <Card variant="default" className="flex items-center gap-3 p-2.5">
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
          handled
            ? "bg-success-soft text-success-strong"
            : "bg-destructive-soft text-destructive-strong"
        )}
      >
        {handled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground truncate" title={threat.threatName}>
          {threat.threatName}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {threat.detectedAt.split("T")[0]}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold",
          tone
        )}
      >
        {threat.status}
      </span>
    </Card>
  );
}
