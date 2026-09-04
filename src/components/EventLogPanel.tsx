import { useState } from "react";
import { AlertOctagon, AlertTriangle, ExternalLink, Loader2, RotateCw, ScrollText } from "lucide-react";
import type { EventSummary } from "@/lib/types";
import { openEventViewer, recentEventSummaries } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

const RANGES = [7, 30] as const;

/** Olay günlüğü kategorisi — son N gündeki Kritik/Hata olay özetleri (PII-güvenli panel). */
export function EventLogPanel() {
  const t = useT();
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const { data: events, loading, error, reload } = useAsync(
    () => recentEventSummaries(days),
    [days]
  );

  const criticalCount = events?.filter((e) => isCritical(e.level)).reduce((a, e) => a + e.count, 0) ?? 0;
  const errorCount = events?.filter((e) => !isCritical(e.level)).reduce((a, e) => a + e.count, 0) ?? 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("eventPanelHeading")}
        </h3>
        <div className="flex items-center gap-2">
          {/* gün aralığı */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-mono transition-colors",
                  days === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                {t("eventPanelDays", { days: r })}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:text-primary-strong disabled:opacity-50"
          >
            <RotateCw className={cn("w-3 h-3", loading && "animate-spin")} />
            {t("rescan")}
          </button>
        </div>
      </div>

      {/* özet + olay görüntüleyici */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          {events
            ? t("eventPanelSummary", { critical: criticalCount, error: errorCount, days })
            : t("eventPanelIntro")}
        </p>
        <Button size="sm" variant="outline" onClick={() => openEventViewer().catch(() => {})}>
          <ExternalLink className="w-3.5 h-3.5" />
          {t("eventPanelOpenViewer")}
        </Button>
      </div>

      {loading && !events && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("eventPanelLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">{error}</div>
      )}

      {events && events.length === 0 && !loading && (
        <Card variant="default" className="p-5 text-center">
          <ScrollText className="w-7 h-7 mx-auto text-success mb-2" />
          <p className="text-sm text-foreground/90">{t("eventPanelEmpty", { days })}</p>
        </Card>
      )}

      {events && events.length > 0 && (
        <div className="space-y-1.5">
          {events.map((e, i) => (
            <EventRow key={`${e.provider}-${e.eventId}-${i}`} ev={e} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">{t("eventPanelFootnote")}</p>
    </div>
  );
}

function isCritical(level: string): boolean {
  const l = level.toLowerCase();
  return l === "critical" || l === "kritik";
}

function EventRow({ ev }: { ev: EventSummary }) {
  const t = useT();
  const critical = isCritical(ev.level);
  return (
    <Card
      variant="default"
      className={cn(
        "flex items-center gap-3 p-3",
        critical ? "border-destructive/30" : "border-warning/30"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
          critical ? "bg-destructive-soft text-destructive-strong" : "bg-warning-soft text-warning-strong"
        )}
      >
        {critical ? <AlertOctagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate" title={ev.provider}>
          {ev.provider}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
          {t("eventPanelEventId", { id: ev.eventId })} · {t("eventPanelLastSeen", { date: ev.lastOccurred })}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums",
          critical ? "bg-destructive-soft text-destructive-strong" : "bg-warning-soft text-warning-strong"
        )}
      >
        {t("eventPanelCount", { count: ev.count })}
      </span>
    </Card>
  );
}
