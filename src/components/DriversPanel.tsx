import { useMemo } from "react";
import { Cpu, ExternalLink, Loader2, RotateCw, ShieldAlert, Clock } from "lucide-react";
import type { DriverInfo } from "@/lib/types";
import { listFlaggedDrivers, openOemLink } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

/** Sürücüler kategorisi — dikkat gerektiren sürücüler (imzasız + uzun süredir güncellenmemiş). */
export function DriversPanel() {
  const t = useT();
  const { data: drivers, loading, error, reload: load } = useAsync(listFlaggedDrivers);

  const { unsigned, outdated } = useMemo(() => {
    const list = drivers ?? [];
    return {
      unsigned: list.filter((d) => !d.isSigned),
      // imzalı ama eski (imzasızları tekrar gösterme)
      outdated: list.filter((d) => d.isSigned),
    };
  }, [drivers]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("driversHeading")}
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openOemLink("ms-settings:windowsupdate").catch(() => {})}>
            <ExternalLink className="w-3.5 h-3.5" />
            {t("driversUpdateCta")}
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
      <p className="text-xs text-muted-foreground px-1 -mt-1">{t("driversIntro")}</p>

      {loading && !drivers && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("driversLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">{error}</div>
      )}

      {drivers && drivers.length === 0 && !loading && (
        <Card variant="default" className="p-5 text-center">
          <Cpu className="w-7 h-7 mx-auto text-success mb-2" />
          <p className="text-sm text-foreground/90">{t("driversEmpty")}</p>
        </Card>
      )}

      {unsigned.length > 0 && (
        <Group
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          tone="warning"
          title={t("driversUnsignedTitle", { count: unsigned.length })}
          hint={t("driversUnsignedHint")}
        >
          {unsigned.map((d, i) => (
            <DriverRow key={`u-${d.deviceName}-${i}`} driver={d} unsigned />
          ))}
        </Group>
      )}

      {outdated.length > 0 && (
        <Group
          icon={<Clock className="w-3.5 h-3.5" />}
          tone="info"
          title={t("driversOutdatedTitle", { count: outdated.length })}
          hint={t("driversOutdatedHint")}
        >
          {outdated.map((d, i) => (
            <DriverRow key={`o-${d.deviceName}-${i}`} driver={d} />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  icon,
  tone,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  tone: "warning" | "info";
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide",
          tone === "warning" ? "text-warning-strong" : "text-info-strong"
        )}
      >
        {icon}
        {title}
      </div>
      <p className="text-[11px] text-muted-foreground px-0.5 -mt-0.5">{hint}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DriverRow({ driver, unsigned = false }: { driver: DriverInfo; unsigned?: boolean }) {
  const t = useT();
  const years = (driver.ageDays / 365).toFixed(1);
  return (
    <Card
      variant="default"
      className={cn("flex items-center gap-3 p-3", unsigned ? "border-warning/30" : "border-border")}
    >
      <span
        className={cn(
          "shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
          unsigned ? "bg-warning-soft text-warning-strong" : "bg-muted text-muted-foreground"
        )}
      >
        <Cpu className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate" title={driver.deviceName}>
          {driver.deviceName}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground truncate">
          {driver.manufacturer || "—"}
          {driver.class && ` · ${driver.class}`}
          {driver.driverVersion && ` · v${driver.driverVersion}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[11px] font-mono text-foreground/80 tabular-nums">{driver.driverDate}</div>
        <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {t("driversAgeYears", { years })}
        </div>
      </div>
    </Card>
  );
}
