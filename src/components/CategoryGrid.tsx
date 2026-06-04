import { ListChecks } from "lucide-react";
import type { ScanReport } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CATEGORIES, categoryStat, type CategoryStatus } from "./categoryDefs";

interface Props {
  report: ScanReport;
  /** Tile tıklanınca sorun listesine in. */
  onSelect?: () => void;
}

const STATUS_TINT: Record<CategoryStatus, string> = {
  ok: "bg-success-soft text-success-strong",
  info: "bg-info-soft text-info-strong",
  warning: "bg-warning-soft text-warning-strong",
  critical: "bg-destructive-soft text-destructive-strong",
};

const STATUS_RING: Record<CategoryStatus, string> = {
  ok: "border-border/60",
  info: "border-info/40",
  warning: "border-warning/50",
  critical: "border-destructive/50",
};

export function CategoryGrid({ report, onSelect }: Props) {
  const t = useT();

  return (
    <section className="mb-8">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3 flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5" />
        {t("categoryScopeTitle")}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {CATEGORIES.map((cat, i) => {
          const stat = categoryStat(cat, report);
          const Icon = cat.icon;
          const interactive = stat.status !== "ok";
          return (
            <button
              key={cat.key}
              type="button"
              onClick={interactive ? onSelect : undefined}
              tabIndex={interactive ? 0 : -1}
              className={cn(
                "group flex items-center gap-3 p-3 rounded-lg border bg-card text-left animate-rise-in",
                "transition-[transform,box-shadow,border-color] duration-200",
                STATUS_RING[stat.status],
                interactive
                  ? "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  : "cursor-default opacity-95"
              )}
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <span
                className={cn(
                  "shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-transform",
                  STATUS_TINT[stat.status],
                  interactive && "group-hover:scale-110"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground truncate">
                  {cat.label}
                </span>
                <span
                  className={cn(
                    "block text-[11px] font-medium tabular-nums",
                    stat.status === "ok" ? "text-muted-foreground" : "text-foreground/70"
                  )}
                >
                  {stat.status === "ok"
                    ? t("categoryClean")
                    : t("categoryCount", { count: stat.count })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
