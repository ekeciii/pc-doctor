import { useEffect, useState } from "react";
import { scanFindingsTrend } from "@/lib/api";
import type { DateCount } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  code: string;
  days?: number;
}

/**
 * Sprint 10 T — pure SVG sparkline.
 *
 * Code'un son N gündeki günlük sayısını minimal sparkline çizer.
 * No library; 12-30 nokta yeterli.
 */
export function TrendSparkline({ code, days = 30 }: Props) {
  const t = useT();
  const [data, setData] = useState<DateCount[] | null>(null);

  useEffect(() => {
    scanFindingsTrend(code, days).then(setData);
  }, [code, days]);

  if (data === null) return null;
  if (data.length === 0) {
    return <div className="text-[10px] text-muted-foreground italic">{t("trendNoData")}</div>;
  }

  const width = 120;
  const height = 24;
  const padding = 2;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data
    .map((d, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (d.count / maxCount) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const totalCount = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex items-center gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-primary"
        role="img"
        aria-label={t("trendLast30Days", { count: totalCount })}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          if (i !== data.length - 1) return null;
          const x = padding + i * stepX;
          const y = height - padding - (d.count / maxCount) * (height - padding * 2);
          return <circle key={i} cx={x} cy={y} r="2" fill="currentColor" />;
        })}
      </svg>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {t("trendLast30Days", { count: totalCount })}
      </span>
    </div>
  );
}
