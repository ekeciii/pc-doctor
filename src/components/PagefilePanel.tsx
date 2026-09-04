import {
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  MemoryStick,
  Moon,
  RotateCw,
  Wrench,
} from "lucide-react";
import { openSystemPropertiesPerformance, pagefileInfo } from "@/lib/api";
import { useByteFmt, useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Progress } from "./ui/Progress";
import { cn } from "@/lib/utils";

interface Props {
  /** Pagefile'ı sistem-yönetimli yap (reboot gerektirir → run_fix_all). */
  onSetManaged: () => void;
}

/** Sanal bellek kategorisi — RAM/pagefile/hibernation durum panosu. */
export function PagefilePanel({ onSetManaged }: Props) {
  const t = useT();
  const fmtBytes = useByteFmt();
  const { data: snap, loading, error, reload: load } = useAsync(pagefileInfo);
  // pagefileInfo null dönebilir (veri yok) — hata değil, "kullanılamıyor" durumu.
  const unavailable = !loading && !error && snap == null;

  const mb = (m: number) => fmtBytes(m * 1024 * 1024);
  const usagePct =
    snap && snap.allocatedMb > 0 ? Math.min(100, (snap.peakMb / snap.allocatedMb) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("pagefileHeading")}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openSystemPropertiesPerformance().catch(() => {})}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("pagefileAdvancedCta")}
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

      {loading && !snap && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("pagefileLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {error}
        </div>
      )}

      {unavailable && !loading && (
        <Card variant="default" className="p-4 text-sm text-muted-foreground">
          {t("pagefileUnavailable")}
        </Card>
      )}

      {snap && (
        <>
          {/* mod kartı */}
          <Card
            variant="default"
            className={cn(
              "flex items-center gap-3 p-4",
              snap.automaticManaged ? "border-success/30" : "border-info/30"
            )}
          >
            <span
              className={cn(
                "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
                snap.automaticManaged
                  ? "bg-success-soft text-success-strong"
                  : "bg-info-soft text-info-strong"
              )}
            >
              {snap.automaticManaged ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Database className="w-4 h-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{t("pagefileMode")}</div>
              <div className="text-xs text-muted-foreground">
                {snap.automaticManaged ? t("pagefileManaged") : t("pagefileManual")}
              </div>
            </div>
            {!snap.automaticManaged && (
              <Button size="sm" onClick={onSetManaged}>
                <Wrench className="w-4 h-4" />
                {t("pagefileSetManaged")}
              </Button>
            )}
          </Card>

          {/* metrikler */}
          <div className="grid grid-cols-2 gap-2.5">
            <MetricTile
              icon={<MemoryStick className="w-3.5 h-3.5" />}
              label={t("pagefileRam")}
              value={mb(snap.totalRamMb)}
            />
            <MetricTile
              icon={<Moon className="w-3.5 h-3.5" />}
              label={t("pagefileHibernation")}
              value={
                snap.hibernationEnabled
                  ? `${t("defenderOn")} · ${mb(snap.hiberfilMb)}`
                  : t("defenderOff")
              }
            />
          </div>

          {/* pagefile kullanımı (manuel modda anlamlı) */}
          {snap.allocatedMb > 0 && (
            <Card variant="default" className="p-3">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                <span>{t("pagefileUsage")}</span>
                <span className="tabular-nums text-foreground/90">
                  {mb(snap.peakMb)} / {mb(snap.allocatedMb)} · %{usagePct.toFixed(0)}
                </span>
              </div>
              <Progress value={usagePct} tone={usagePct >= 90 ? "warning" : "primary"} />
            </Card>
          )}

          {/* yapılandırılmış pagefile'lar */}
          {snap.configured.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground px-1">
                {t("pagefileConfigured")}
              </span>
              {snap.configured.map((e, i) => (
                <Card key={i} variant="default" className="flex items-center gap-3 p-2.5">
                  <Database className="w-4 h-4 text-primary shrink-0" />
                  <span
                    className="text-sm font-mono text-foreground truncate flex-1"
                    title={e.name}
                  >
                    {e.name}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
                    {e.initialSizeMb === 0 && e.maximumSizeMb === 0
                      ? t("pagefileSystemManagedSize")
                      : `${mb(e.initialSizeMb)} – ${mb(e.maximumSizeMb)}`}
                  </span>
                </Card>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
            {t("pagefileFootnote")}
          </p>
        </>
      )}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card variant="default" className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-base font-display font-bold tabular-nums mt-0.5 text-foreground">
        {value}
      </div>
    </Card>
  );
}
