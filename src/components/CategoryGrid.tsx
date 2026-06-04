import { ListChecks } from "lucide-react";
import type { ScanReport } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CATEGORIES, categoryStat, type CategoryStatus } from "./categoryDefs";

interface Props {
  report: ScanReport;
  onSelect?: () => void;
}

const STATUS_TINT: Record<CategoryStatus, string> = {
  ok: "bg-success-soft/70 text-success-strong",
  info: "bg-info-soft/70 text-info-strong",
  warning: "bg-warning-soft/70 text-warning-strong",
  critical: "bg-destructive-soft/70 text-destructive-strong",
};

/** Durum → neon glow rengi (LED + kenar). */
const STATUS_GLOW: Record<CategoryStatus, string> = {
  ok: "var(--color-success)",
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

export function CategoryGrid({ report, onSelect }: Props) {
  const t = useT();

  return (
    <section className="mb-8">
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3 flex items-center gap-1.5 font-mono">
        <ListChecks className="w-3.5 h-3.5 text-primary" />
        {t("categoryScopeTitle")}
        <span className="flex-1 h-px ml-2 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {CATEGORIES.map((cat, i) => {
          const stat = categoryStat(cat, report);
          const Icon = cat.icon;
          const glow = STATUS_GLOW[stat.status];
          const interactive = stat.status !== "ok";
          return (
            <button
              key={cat.key}
              type="button"
              onClick={interactive ? onSelect : undefined}
              tabIndex={interactive ? 0 : -1}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-lg border bg-card/55 backdrop-blur-sm text-left animate-rise-in overflow-hidden",
                "transition-[transform,box-shadow,border-color] duration-200",
                interactive ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default"
              )}
              style={{
                borderColor: `color-mix(in oklch, ${glow} ${stat.status === "ok" ? 14 : 38}%, transparent)`,
                animationDelay: `${i * 35}ms`,
              }}
            >
              {/* durum LED'i */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 right-2 w-1.5 h-1.5 rounded-full",
                  stat.status === "critical" && "animate-pulse-glow"
                )}
                style={{ background: glow, boxShadow: `0 0 7px ${glow}` }}
              />
              {/* hover glow */}
              {interactive && (
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at 0% 0%, color-mix(in oklch, ${glow} 16%, transparent), transparent 60%)` }}
                />
              )}
              <span
                className={cn(
                  "relative shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-transform",
                  STATUS_TINT[stat.status],
                  interactive && "group-hover:scale-110"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground truncate">{cat.label}</span>
                <span
                  className={cn(
                    "block text-[11px] font-mono tabular-nums",
                    stat.status === "ok" ? "text-muted-foreground" : "text-foreground/70"
                  )}
                >
                  {stat.status === "ok" ? t("categoryClean") : t("categoryCount", { count: stat.count })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
