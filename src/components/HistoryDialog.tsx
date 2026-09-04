import { useEffect, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Alert, AlertDescription } from "./ui/Alert";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { listScans, listScanFindings, clearHistory, toError, type ScanRecord } from "@/lib/api";
import { metricLabel, resolveFinding, useDateFmt, useI18n, useT } from "@/lib/i18n";
import { TrendSparkline } from "./TrendSparkline";
import { HistoryTrendTab } from "./HistoryTrendTab";
import type { Finding, ScanFindingDetail, Severity } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SeverityMeta {
  icon: JSX.Element;
  badge: "destructive-soft" | "warning-soft" | "info-soft" | "success-soft";
  iconBg: string;
}

const SEVERITY: Record<string, SeverityMeta> = {
  critical: {
    icon: <AlertOctagon className="w-4 h-4" />,
    badge: "destructive-soft",
    iconBg: "bg-destructive-soft text-destructive-strong",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    badge: "warning-soft",
    iconBg: "bg-warning-soft text-warning-strong",
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    badge: "info-soft",
    iconBg: "bg-info-soft text-info-strong",
  },
  good: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    badge: "success-soft",
    iconBg: "bg-success-soft text-success-strong",
  },
};

const SEVERITY_LABEL_KEYS = {
  critical: "severityCritical",
  warning: "severityWarning",
  info: "severityInfo",
  good: "severityGood",
} as const;

export function HistoryDialog({ open, onClose }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const dateFmt = useDateFmt();
  const [records, setRecords] = useState<ScanRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, ScanFindingDetail[]>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  // Sprint 11 T-ext — tab toggle
  const [activeTab, setActiveTab] = useState<"history" | "trend">("history");

  const reload = async () => {
    setError(null);
    try {
      const rows = await listScans(100);
      setRecords(rows);
    } catch (e) {
      setError(`${t("historyLoadFailed")}: ${toError(e).message}`);
      setRecords([]);
    }
  };

  useEffect(() => {
    if (!open) {
      setExpandedId(null);
      return;
    }
    setRecords(null);
    setDetailCache({});
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleExpand = async (scanId: number) => {
    if (expandedId === scanId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(scanId);
    if (!detailCache[scanId]) {
      setDetailLoading(scanId);
      try {
        const details = await listScanFindings(scanId);
        setDetailCache((prev) => ({ ...prev, [scanId]: details }));
      } catch (e) {
        console.warn("[history] detail load failed:", e);
      } finally {
        setDetailLoading(null);
      }
    }
  };

  const handleClear = async () => {
    if (!confirm(t("historyClearConfirm"))) return;
    setWorking(true);
    try {
      await clearHistory();
      setExpandedId(null);
      setDetailCache({});
      await reload();
    } catch (e) {
      setError(toError(e).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex-1">
            <DialogTitle>{t("historyTitle")}</DialogTitle>
            <DialogDescription className="mt-1">{t("settingsHistoryExplain")}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {/* Sprint 11 T-ext — tab toggle */}
          <div
            role="tablist"
            aria-label={t("historyTitle")}
            className="flex gap-1 border-b border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "history"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("historyTabHistory")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "trend"}
              onClick={() => setActiveTab("trend")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "trend"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("historyTabTrend")}
            </button>
          </div>

          {activeTab === "trend" && <HistoryTrendTab />}

          {activeTab === "history" && error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {activeTab === "history" && records !== null && records.length === 0 && !error && (
            <Alert variant="info">
              <AlertDescription>{t("historyEmpty")}</AlertDescription>
            </Alert>
          )}
          {activeTab === "history" && records && records.length > 0 && (
            <ul className="space-y-2">
              {records.map((r) => {
                const sev = SEVERITY[r.severityMax] ?? SEVERITY.good;
                const sevKey =
                  SEVERITY_LABEL_KEYS[r.severityMax as keyof typeof SEVERITY_LABEL_KEYS] ??
                  "severityGood";
                const started = new Date(r.startedAt);
                const isExpanded = expandedId === r.id;
                const details = detailCache[r.id];
                const canExpand = r.findingCount > 0;
                return (
                  <li key={r.id}>
                    <Card variant="default">
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent transition-colors"
                        onClick={() => canExpand && toggleExpand(r.id)}
                        disabled={!canExpand}
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded ? t("historyDetailCollapse") : t("historyDetailExpand")
                        }
                      >
                        <div
                          className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${sev.iconBg}`}
                        >
                          {sev.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">
                            {dateFmt.format(started)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t("historyColFindings")}: {r.findingCount}
                            {r.criticalCount > 0 &&
                              ` · ${r.criticalCount} ${t("severityCritical")}`}
                            {r.warningCount > 0 && ` · ${r.warningCount} ${t("severityWarning")}`}
                          </div>
                        </div>
                        <Badge variant={sev.badge} size="default">
                          {t(sevKey)}
                        </Badge>
                        {canExpand && (
                          <div className="shrink-0 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 p-3.5 space-y-2">
                          {detailLoading === r.id && (
                            <div className="text-xs text-muted-foreground">
                              {t("historyDetailLoading")}
                            </div>
                          )}
                          {details && details.length === 0 && (
                            <div className="text-xs text-muted-foreground">
                              {t("historyDetailEmpty")}
                            </div>
                          )}
                          {details && details.length > 0 && (
                            <ul className="space-y-1.5">
                              {details.map((d) => (
                                <FindingRow key={d.id} detail={d} locale={locale} />
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="destructive"
            size="default"
            onClick={handleClear}
            disabled={working || !records || records.length === 0}
          >
            {t("settingsClearHistory")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("settingsClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FindingRow({ detail, locale }: { detail: ScanFindingDetail; locale: "tr" | "en" }) {
  // Parse params_json defansif — Sprint 7 sanitize_params'tan ZATEN geçmiş.
  let params: Record<string, string | number> | null = null;
  if (detail.paramsJson) {
    try {
      params = JSON.parse(detail.paramsJson);
    } catch {
      // ignore
    }
  }
  // Code'dan title/description code'larını çıkar (örn "finding.driver.unsigned.title" yok ama
  // backend code field'ı title_code'u yazıyor — biz onu base alıp resolve ederiz).
  const titleCode = detail.code;
  const descriptionCode = detail.code.replace(/\.title$/, ".description");
  const synthetic: Finding = {
    id: String(detail.id),
    category: detail.category,
    title: "",
    description: "",
    severity: detail.severity as Severity,
    metric: null,
    recommendedAction: null,
    action: null,
    titleCode,
    descriptionCode,
    params,
  };
  const resolved = resolveFinding(synthetic, locale);
  const sev = SEVERITY[detail.severity] ?? SEVERITY.good;
  const metric = metricLabel(null, titleCode, params, locale);
  return (
    <li className="flex items-start gap-2 text-xs">
      <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${sev.iconBg}`}>
        {sev.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{resolved.title}</div>
        {resolved.description && (
          <div className="text-muted-foreground mt-0.5 leading-snug">{resolved.description}</div>
        )}
        {/* Sprint 10 T — trendline mini sparkline */}
        <div className="mt-1">
          <TrendSparkline code={titleCode} days={30} />
        </div>
      </div>
      {metric && (
        <Badge variant={sev.badge} size="sm">
          {metric}
        </Badge>
      )}
    </li>
  );
}
