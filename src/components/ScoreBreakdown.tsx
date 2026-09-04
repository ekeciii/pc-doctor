import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CategoryPenalty } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  breakdown: CategoryPenalty[];
}

/** Kategori başına tavan (backend ile aynı) — bar genişliği için referans. */
const CATEGORY_CAP = 30;

export function ScoreBreakdown({ breakdown }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (breakdown.length === 0) return null;

  return (
    <div className="w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "mx-auto flex items-center gap-1.5 text-xs font-medium",
          "text-muted-foreground hover:text-foreground transition-colors"
        )}
      >
        {t("scoreBreakdownTitle")}
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul className="mt-3 space-y-1.5 animate-fade-in">
          {breakdown.map((row) => (
            <li
              key={row.category}
              className="flex items-center gap-3 text-sm rounded-md px-2.5 py-1.5 bg-muted/40"
            >
              <span className="flex-1 min-w-0 truncate text-foreground">{row.category}</span>
              <span
                aria-hidden
                className="h-1.5 rounded-full bg-destructive/55"
                style={{ width: `${Math.max(12, (row.penalty / CATEGORY_CAP) * 64)}px` }}
              />
              <span className="font-mono tabular-nums text-xs text-muted-foreground w-12 text-right">
                {t("scoreBreakdownPoints", { points: row.penalty })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
