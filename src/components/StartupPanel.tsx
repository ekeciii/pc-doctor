import { ExternalLink, Loader2, Power, RotateCw, Timer } from "lucide-react";
import type { StartupItem } from "@/lib/types";
import { openOemLink, startupInfo } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

/** Başlangıç kategorisi — boot süresi + başlangıç öğeleri listesi (rehberli yönetim). */
export function StartupPanel() {
  const t = useT();
  const { data: info, loading, error, reload: load } = useAsync(startupInfo);

  const bootSecs = info?.lastBootDurationMs != null ? Math.round(info.lastBootDurationMs / 1000) : null;
  const bootTone = bootSecs == null ? "muted" : bootSecs >= 120 ? "bad" : bootSecs >= 60 ? "warn" : "ok";
  const count = info?.items.length ?? 0;
  const countTone = count >= 25 ? "warn" : count >= 15 ? "info" : "ok";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("startupHeading")}
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openOemLink("ms-settings:startupapps").catch(() => {})}>
            <ExternalLink className="w-3.5 h-3.5" />
            {t("startupManageCta")}
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

      {loading && !info && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("startupLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">{error}</div>
      )}

      {info && (
        <>
          {/* özet metrikler */}
          <div className="grid grid-cols-2 gap-2.5">
            <MetricTile
              icon={<Timer className="w-3.5 h-3.5" />}
              label={t("startupBootTime")}
              value={bootSecs == null ? "—" : t("startupSeconds", { s: bootSecs })}
              tone={bootTone}
            />
            <MetricTile
              icon={<Power className="w-3.5 h-3.5" />}
              label={t("startupItemCount")}
              value={String(count)}
              tone={countTone}
            />
          </div>

          {bootSecs == null && (
            <p className="text-[11px] text-muted-foreground px-1">{t("startupBootUnknown")}</p>
          )}

          {/* öğe listesi */}
          {info.items.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground px-1">
                {t("startupItemsTitle")}
              </span>
              {info.items.map((item, i) => (
                <StartupRow key={`${item.name}-${i}`} item={item} />
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">{t("startupFootnote")}</p>
        </>
      )}
    </div>
  );
}

type Tone = "ok" | "warn" | "bad" | "info" | "muted";

function MetricTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: Tone;
}) {
  const toneClass =
    tone === "bad"
      ? "text-destructive-strong"
      : tone === "warn"
        ? "text-warning-strong"
        : tone === "info"
          ? "text-info-strong"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <Card variant="default" className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-xl font-display font-bold tabular-nums mt-0.5", toneClass)}>{value}</div>
    </Card>
  );
}

function StartupRow({ item }: { item: StartupItem }) {
  return (
    <Card variant="default" className="flex items-center gap-3 p-2.5">
      <span className="shrink-0 w-7 h-7 rounded-md bg-primary-soft text-primary-strong flex items-center justify-center">
        <Power className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground truncate" title={item.command || item.name}>
          {item.name}
        </div>
        {item.command && (
          <div className="text-[11px] font-mono text-muted-foreground truncate" title={item.command}>
            {item.command}
          </div>
        )}
      </div>
      {item.location && (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground max-w-[40%] truncate" title={item.location}>
          {item.location}
        </span>
      )}
    </Card>
  );
}
