import { ListChecks, ShieldCheck } from "lucide-react";
import type { ScanReport } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  categoryStat,
  type CategoryDef,
  type CategoryStatus,
} from "./categoryDefs";

interface Props {
  report: ScanReport;
  /** Bir kategoriye tıklanınca yandan detay paneline geç. */
  onSelect: (cat: CategoryDef) => void;
}

const STATUS_TINT: Record<CategoryStatus, string> = {
  ok: "bg-success-soft/70 text-success-strong",
  info: "bg-info-soft/70 text-info-strong",
  warning: "bg-warning-soft/70 text-warning-strong",
  critical: "bg-destructive-soft/70 text-destructive-strong",
};

const STATUS_GLOW: Record<CategoryStatus, string> = {
  ok: "var(--color-success)",
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

export function CategoryGrid({ report, onSelect }: Props) {
  const t = useT();

  // "hata olanlar kalsın sadece" — yalnız sorunlu (status != ok) kategoriler.
  const problems = CATEGORIES.map((cat) => ({ cat, stat: categoryStat(cat, report) })).filter(
    (x) => x.stat.status !== "ok"
  );

  if (problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center animate-fade-in">
        <span className="w-14 h-14 rounded-full bg-success-soft text-success-strong flex items-center justify-center">
          <ShieldCheck className="w-7 h-7" />
        </span>
        <p className="font-display text-lg font-semibold text-foreground">{t("scanHealthyTitle")}</p>
        <p className="text-sm text-muted-foreground max-w-sm">{t("scanHealthyBody")}</p>
      </div>
    );
  }

  return (
    <section>
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3 flex items-center gap-1.5 font-mono">
        <ListChecks className="w-3.5 h-3.5 text-primary" />
        {t("categoryProblemsTitle", { count: problems.length })}
        <span className="flex-1 h-px ml-2 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {problems.map(({ cat, stat }, i) => {
          const Icon = cat.icon;
          const glow = STATUS_GLOW[stat.status];
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
                borderColor: `color-mix(in oklch, ${glow} 38%, transparent)`,
                animationDelay: `${i * 40}ms`,
              }}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 right-2 w-1.5 h-1.5 rounded-full",
                  stat.status === "critical" && "animate-pulse-glow"
                )}
                style={{ background: glow, boxShadow: `0 0 7px ${glow}` }}
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
                <span className="block text-sm font-medium text-foreground truncate">{cat.label}</span>
                <span className="block text-[11px] font-mono tabular-nums text-foreground/70">
                  {t("categoryCount", { count: stat.count })}
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
