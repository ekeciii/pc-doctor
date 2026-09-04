import {
  BatteryCharging,
  ExternalLink,
  Gauge,
  Laptop,
  Loader2,
  Monitor,
  Plug,
  RotateCw,
  Thermometer,
} from "lucide-react";
import { openOemLink, thermalSnapshot } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Progress } from "./ui/Progress";
import { cn } from "@/lib/utils";

/** Sıcaklık kategorisi — termal bölgeler + CPU performans/yük göstergeleri. */
export function ThermalPanel() {
  const t = useT();
  const { data: snap, loading, error, reload: load } = useAsync(thermalSnapshot);

  const maxTemp = snap && snap.zonesCelsius.length > 0 ? Math.max(...snap.zonesCelsius) : null;
  const perf = snap?.processorPerformancePercentAvg ?? null;
  const load_ = snap?.processorLoadPercentAvg ?? null;
  // Throttling: yük ≥%50 iken performans baz hızın çok altında.
  const throttling = perf != null && load_ != null && load_ >= 50 && perf < 90;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("thermalHeading")}
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openOemLink("ms-settings:powersleep").catch(() => {})}>
            <ExternalLink className="w-3.5 h-3.5" />
            {t("thermalPowerCta")}
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

      {/* bağlam chip'leri */}
      {snap && (
        <div className="flex flex-wrap gap-2 px-1">
          <ContextChip
            icon={snap.isLaptop ? <Laptop className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            label={snap.isLaptop ? t("thermalLaptop") : t("thermalDesktop")}
          />
          {snap.onAcPower != null && (
            <ContextChip
              icon={snap.onAcPower ? <Plug className="w-3.5 h-3.5" /> : <BatteryCharging className="w-3.5 h-3.5" />}
              label={snap.onAcPower ? t("thermalAc") : t("thermalBattery")}
            />
          )}
        </div>
      )}

      {loading && !snap && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("thermalLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">{error}</div>
      )}

      {snap && (
        <>
          {/* CPU performans + yük */}
          <div className="grid grid-cols-2 gap-2.5">
            <GaugeTile
              icon={<Gauge className="w-3.5 h-3.5" />}
              label={t("thermalCpuPerf")}
              value={perf}
              suffix="%"
              tone={throttling ? "warn" : "ok"}
            />
            <GaugeTile
              icon={<Gauge className="w-3.5 h-3.5" />}
              label={t("thermalCpuLoad")}
              value={load_}
              suffix="%"
              tone="neutral"
            />
          </div>

          {throttling && (
            <p className="text-xs border-l-2 border-warning/60 text-warning-strong pl-3">
              {t("thermalThrottlingNote")}
            </p>
          )}

          {/* termal bölgeler */}
          {snap.zonesCelsius.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5" />
                  {t("thermalZones")}
                </span>
                {maxTemp != null && (
                  <span
                    className={cn(
                      "text-sm font-display font-bold tabular-nums",
                      tempClass(maxTemp)
                    )}
                  >
                    {t("thermalMax")}: {maxTemp.toFixed(0)}°C
                  </span>
                )}
              </div>
              {snap.zonesCelsius.map((c, i) => (
                <Card key={i} variant="default" className="flex items-center gap-3 p-2.5">
                  <span className="text-[11px] font-mono text-muted-foreground w-20 shrink-0">
                    {t("thermalZone", { n: i + 1 })}
                  </span>
                  <div className="flex-1">
                    <Progress
                      value={Math.min(100, (c / 100) * 100)}
                      tone={c >= 85 ? "destructive" : c >= 75 ? "warning" : "primary"}
                    />
                  </div>
                  <span className={cn("text-sm font-mono font-semibold tabular-nums w-14 text-right", tempClass(c))}>
                    {c.toFixed(0)}°C
                  </span>
                </Card>
              ))}
            </div>
          ) : (
            <Card variant="default" className="p-4 text-xs text-muted-foreground leading-relaxed">
              {t("thermalNoSensors")}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function tempClass(c: number): string {
  return c >= 85 ? "text-destructive-strong" : c >= 75 ? "text-warning-strong" : "text-foreground";
}

function ContextChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-muted text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function GaugeTile({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  suffix: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const toneClass = tone === "warn" ? "text-warning-strong" : "text-foreground";
  return (
    <Card variant="default" className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-xl font-display font-bold tabular-nums mt-0.5", toneClass)}>
        {value == null ? "—" : `${value.toFixed(0)}${suffix}`}
      </div>
    </Card>
  );
}
