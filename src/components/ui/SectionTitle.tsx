import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  index?: number;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}

export function SectionTitle({ index, eyebrow, children, className }: Props) {
  return (
    <div className={cn("flex items-baseline gap-3 mb-4", className)}>
      {(index !== undefined || eyebrow) && (
        <span className="font-display text-[10px] uppercase tracking-[0.18em] text-primary tabular-nums">
          {eyebrow ?? String(index).padStart(2, "0")}
        </span>
      )}
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
        {children}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
