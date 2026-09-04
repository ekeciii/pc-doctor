import { LayoutGrid } from "lucide-react";
import type { ScanReport } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CATEGORIES, categoryStat, type CategoryDef, type CategoryStatus } from "./categoryDefs";

interface Props {
  /** `null` → henüz taranmadı; kartlar 'bekliyor' (idle) görünür ama yine tıklanabilir. */
  report: ScanReport | null;
  /** Bir kategoriye tıklanınca yandan detay paneline geç. */
  onSelect: (cat: CategoryDef) => void;
}

const STATUS_TINT: Record<CategoryStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  ok: "bg-success-soft/70 text-success-strong",
  info: "bg-info-soft/70 text-info-strong",
  warning: "bg-warning-soft/70 text-warning-strong",
  critical: "bg-destructive-soft/70 text-destructive-strong",
};

const STATUS_GLOW: Record<CategoryStatus, string> = {
  idle: "var(--color-border)",
  ok: "var(--color-success)",
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

/** Tüm tanı kategorileri kart ızgarası. Tarama öncesi de görünür (idle), sonrası durum renkli. */
export function CategoryGrid({ report, onSelect }: Props) {
  const t = useT();
  const cats = CATEGORIES.map((cat) => ({ cat, stat: categoryStat(cat, report) }));
  const problemCount = cats.filter(
    (x) => x.stat.status === "warning" || x.stat.status === "critical"
  ).length;

  return (
    <section className="animate-fade-in">
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3 flex items-center gap-1.5 font-mono">
        <LayoutGrid className="w-3.5 h-3.5 text-primary" />
        {report
          ? problemCount > 0
            ? t("categoryProblemsTitle", { count: problemCount })
            : t("categoryAllOk")
          : t("categoryIdleTitle")}
        <span className="flex-1 h-px ml-2 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {cats.map(({ cat, stat }, i) => {
          const Icon = cat.icon;
          const glow = STATUS_GLOW[stat.status];
          const isProblem = stat.status === "warning" || stat.status === "critical";
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onSelect(cat)}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-lg border bg-card/55 backdrop-blur-sm text-left animate-rise-in overflow-hidden",
                "transition-[transform,box-shadow,border-color] duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
              )}
              style={{
                borderColor:
                  stat.status === "idle"
                    ? "var(--color-border)"
                    : `color-mix(in oklch, ${glow} 38%, transparent)`,
                animationDelay: `${i * 35}ms`,
              }}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 right-2 w-1.5 h-1.5 rounded-full",
                  stat.status === "critical" && "animate-pulse-glow"
                )}
                style={{
                  background: glow,
                  boxShadow: stat.status === "idle" ? "none" : `0 0 7px ${glow}`,
                }}
              />
              <span
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at 0% 0%, color-mix(in oklch, ${glow} 16%, transparent), transparent 60%)`,
                }}
              />
              <span
                className={cn(
                  "relative shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-transform group-hover:scale-110",
                  STATUS_TINT[stat.status]
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground truncate">
                  {cat.label}
                </span>
                <span className="block text-[11px] font-mono tabular-nums text-foreground/70">
                  {stat.status === "idle"
                    ? t("categoryIdle")
                    : isProblem
                      ? t("categoryCount", { count: stat.count })
                      : t("categoryOk")}
                </span>
              </span>
              <span
                aria-hidden
                className="relative shrink-0 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-[color,transform]"
              >
                ›
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
