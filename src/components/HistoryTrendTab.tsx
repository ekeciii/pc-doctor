import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "./ui/Alert";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { listScans, listScanFindings, scanFindingsTrendBatch } from "@/lib/api";
import { resolveFinding, useI18n, useT } from "@/lib/i18n";
import { TrendSparkline } from "./TrendSparkline";
import type { Finding, Severity } from "@/lib/types";

/**
 * Sprint 11 T-ext partial — HistoryDialog Trend tab.
 *
 * Tüm geçmiş taramaların finding code'larını topla (critical/warning), her code için
 * son 3 7-günlük pencere counts'i çek; ardışık artış varsa "kötüleşiyor" rozeti göster.
 *
 * Standalone panel + multi-rule alerting Sprint 12'ye ertelendi.
 */
export function HistoryTrendTab() {
  const t = useT();
  const { locale } = useI18n();
  const [codes, setCodes] = useState<{ code: string; category: string; severity: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Record<string, number[]>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Son 100 taramanın critical+warning finding code'larını topla
      const scans = await listScans(100).catch(() => []);
      const codeMap = new Map<
        string,
        { code: string; category: string; severity: string }
      >();
      for (const s of scans) {
        if (s.criticalCount === 0 && s.warningCount === 0) continue;
        const details = await listScanFindings(s.id).catch(() => []);
        for (const d of details) {
          if (d.severity !== "critical" && d.severity !== "warning") continue;
          if (!codeMap.has(d.code)) {
            codeMap.set(d.code, {
              code: d.code,
              category: d.category,
              severity: d.severity,
            });
          }
        }
      }
      const uniqueCodes = Array.from(codeMap.values());
      setCodes(uniqueCodes);
      // Sprint 11 review H5 fix: batch fetch (N+1 önleme).
      const batch = await scanFindingsTrendBatch(
        uniqueCodes.map((c) => c.code),
        21
      );
      const trendData: Record<string, number[]> = {};
      const now = Date.now();
      for (const c of uniqueCodes) {
        const data = batch[c.code] ?? [];
        const weekly = [0, 0, 0];
        for (const d of data) {
          const ts = Date.parse(d.date);
          if (isNaN(ts)) continue;
          const daysAgo = Math.floor((now - ts) / 86400000);
          if (daysAgo < 7) weekly[2] += d.count;
          else if (daysAgo < 14) weekly[1] += d.count;
          else if (daysAgo < 21) weekly[0] += d.count;
        }
        trendData[c.code] = weekly;
      }
      setTrends(trendData);
      setLoading(false);
    })();
  }, []);

  // 3 hafta üst üste artış var mı? (basit kural — Sprint 12'de multi-rule motoru)
  const worsening = useMemo(() => {
    return codes.filter((c) => {
      const w = trends[c.code];
      if (!w || w.length !== 3) return false;
      return w[0] < w[1] && w[1] < w[2] && w[2] > 0;
    });
  }, [codes, trends]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        {t("historyDetailLoading")}
      </div>
    );
  }

  if (codes.length === 0) {
    return (
      <Alert variant="success">
        <AlertDescription>{t("trendNoCriticalCodes")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {worsening.length > 0 && (
        <Alert variant="warning" className="items-start">
          <AlertOctagon />
          <div className="flex-1">
            <AlertDescription>
              {t("trendWorseningHint", { count: worsening.length })}
            </AlertDescription>
          </div>
        </Alert>
      )}
      <ul className="space-y-2">
        {codes.map((c) => {
          const w = trends[c.code] ?? [0, 0, 0];
          const isWorsening = w[0] < w[1] && w[1] < w[2] && w[2] > 0;
          const synthetic: Finding = {
            id: c.code,
            category: c.category,
            title: "",
            description: "",
            severity: c.severity as Severity,
            metric: null,
            recommendedAction: null,
            action: null,
            titleCode: c.code,
            descriptionCode: c.code.replace(/\.title$/, ".description"),
            params: null,
          };
          const resolved = resolveFinding(synthetic, locale);
          return (
            <li key={c.code}>
              <Card variant="default">
                <div className="flex items-center gap-3 p-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {resolved.title || c.code}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.category}
                    </div>
                    <div className="mt-1">
                      <TrendSparkline code={c.code} days={21} />
                    </div>
                  </div>
                  {isWorsening && (
                    <Badge variant="destructive-soft" size="sm">
                      <TrendingUp className="w-3 h-3 mr-1 inline" />
                      {t("trendWorseningBadge")}
                    </Badge>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
