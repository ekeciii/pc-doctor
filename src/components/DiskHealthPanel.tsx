import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Loader2,
  RotateCw,
  Thermometer,
} from "lucide-react";
import type { SmartDisk } from "@/lib/types";
import { listSmartDisks } from "@/lib/api";
import { useByteFmt, useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Card } from "./ui/Card";
import { Progress } from "./ui/Progress";
import { cn } from "@/lib/utils";

type Verdict = "healthy" | "watch" | "risk";

/** Disk sağlığı kategorisi — fiziksel disklerin SMART telemetri paneli (izleme + öneri). */
export function DiskHealthPanel() {
  const t = useT();
  const { data: disks, loading, error, reload: load } = useAsync(listSmartDisks);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("diskHealthHeading")}
        </h3>
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

      {loading && !disks && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("diskHealthLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {error}
        </div>
      )}

      {disks && disks.length === 0 && !loading && (
        <p className="px-1 py-4 text-sm text-muted-foreground">{t("diskHealthNone")}</p>
      )}

      {disks?.map((d, i) => (
        <DiskCard key={`${d.friendlyName}-${i}`} disk={d} index={i} />
      ))}
    </div>
  );
}

function verdictOf(d: SmartDisk): Verdict {
  const ioErrors = (d.readErrorsTotal ?? 0) + (d.writeErrorsTotal ?? 0);
  const unhealthy = d.healthStatus.toLowerCase() === "unhealthy";
  const warning = d.healthStatus.toLowerCase() === "warning";
  if (unhealthy || ioErrors >= 100 || (d.wearPercent ?? 0) >= 95 || (d.temperatureCelsius ?? 0) >= 80) {
    return "risk";
  }
  if (warning || (d.wearPercent ?? 0) >= 80 || (d.temperatureCelsius ?? 0) >= 70) {
    return "watch";
  }
  return "healthy";
}

const VERDICT_META: Record<
  Verdict,
  { tint: string; glow: string; icon: JSX.Element; labelKey: "diskVerdictHealthy" | "diskVerdictWatch" | "diskVerdictRisk" }
> = {
  healthy: {
    tint: "bg-success-soft text-success-strong",
    glow: "var(--color-success)",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    labelKey: "diskVerdictHealthy",
  },
  watch: {
    tint: "bg-warning-soft text-warning-strong",
    glow: "var(--color-warning)",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    labelKey: "diskVerdictWatch",
  },
  risk: {
    tint: "bg-destructive-soft text-destructive-strong",
    glow: "var(--color-destructive)",
    icon: <AlertOctagon className="w-3.5 h-3.5" />,
    labelKey: "diskVerdictRisk",
  },
};

function DiskCard({ disk, index }: { disk: SmartDisk; index: number }) {
  const t = useT();
  const fmtBytes = useByteFmt();
  const verdict = verdictOf(disk);
  const vm = VERDICT_META[verdict];
  const temp = disk.temperatureCelsius;
  const wear = disk.wearPercent;
  const ioErrors = (disk.readErrorsTotal ?? 0) + (disk.writeErrorsTotal ?? 0);
  const busLabel =
    disk.busType && disk.busType !== "Unknown" && disk.busType !== disk.mediaType
      ? `${disk.mediaType} · ${disk.busType}`
      : disk.mediaType;

  return (
    <Card
      variant="default"
      className="overflow-hidden animate-rise-in"
      style={{
        animationDelay: `${index * 50}ms`,
        borderColor: `color-mix(in oklch, ${vm.glow} 32%, transparent)`,
      }}
    >
      <div className="p-4">
        {/* başlık */}
        <div className="flex items-center gap-3">
          <span
            className="shrink-0 w-9 h-9 rounded-md bg-primary-soft text-primary-strong flex items-center justify-center"
            style={{ boxShadow: `0 0 14px -5px ${vm.glow}` }}
          >
            <HardDrive className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold text-foreground truncate" title={disk.friendlyName}>
              {disk.friendlyName}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {busLabel} · {fmtBytes(disk.sizeBytes)}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono uppercase tracking-wide",
              vm.tint
            )}
          >
            {vm.icon}
            {t(vm.labelKey)}
          </span>
        </div>

        {/* metrik ızgarası */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric label={t("diskMetricHealth")} value={localizedHealth(disk.healthStatus, t)} />
          {temp != null && (
            <Metric
              label={t("diskMetricTemp")}
              value={`${temp}°C`}
              icon={<Thermometer className="w-3 h-3" />}
              tone={temp >= 80 ? "bad" : temp >= 70 ? "warn" : "ok"}
            />
          )}
          {disk.powerOnHours != null && disk.powerOnHours > 0 && (
            <Metric label={t("diskMetricPowerOn")} value={formatHours(disk.powerOnHours, t)} />
          )}
          {ioErrors > 0 && (
            <Metric
              label={t("diskMetricIoErrors")}
              value={`${disk.readErrorsTotal ?? 0}R / ${disk.writeErrorsTotal ?? 0}W`}
              icon={<Activity className="w-3 h-3" />}
              tone={ioErrors >= 100 ? "bad" : "warn"}
            />
          )}
        </div>

        {/* SSD aşınma çubuğu */}
        {wear != null && wear > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
              <span>{t("diskMetricWear")}</span>
              <span className="tabular-nums text-foreground/90">{wear}%</span>
            </div>
            <Progress value={wear} tone={wear >= 95 ? "destructive" : wear >= 80 ? "warning" : "primary"} />
          </div>
        )}

        {/* sorunlu disklerde öneri */}
        {verdict !== "healthy" && (
          <p
            className={cn(
              "mt-3 text-xs leading-relaxed border-l-2 pl-3",
              verdict === "risk"
                ? "border-destructive/60 text-destructive-strong"
                : "border-warning/60 text-warning-strong"
            )}
          >
            {verdict === "risk" ? t("diskAdviceRisk") : t("diskAdviceWatch")}
          </p>
        )}
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = "ok",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "bad" ? "text-destructive-strong" : tone === "warn" ? "text-warning-strong" : "text-foreground";
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className={cn("text-sm font-semibold flex items-center gap-1 truncate", toneClass)}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function localizedHealth(status: string, t: ReturnType<typeof useT>): string {
  switch (status.toLowerCase()) {
    case "healthy":
      return t("diskHealthStatusHealthy");
    case "warning":
      return t("diskHealthStatusWarning");
    case "unhealthy":
      return t("diskHealthStatusUnhealthy");
    default:
      return status;
  }
}

function formatHours(hours: number, t: ReturnType<typeof useT>): string {
  const days = Math.floor(hours / 24);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remDays = days % 365;
    return t("diskPowerOnYears", { years, days: remDays });
  }
  return t("diskPowerOnDays", { days });
}
