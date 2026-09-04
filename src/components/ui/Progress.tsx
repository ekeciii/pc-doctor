import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const progressTrackVariants = cva("w-full overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      sm: "h-1",
      default: "h-1.5",
      lg: "h-2.5",
    },
  },
  defaultVariants: { size: "default" },
});

export const progressFillVariants = cva("h-full rounded-full transition-all duration-700", {
  variants: {
    tone: {
      primary: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: { tone: "primary" },
});

export interface ProgressProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof progressTrackVariants> {
  /** 0-100 */
  value: number;
  tone?: "primary" | "success" | "warning" | "destructive";
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, size, value, tone = "primary", ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(progressTrackVariants({ size }), className)}
        {...props}
      >
        <div className={cn(progressFillVariants({ tone }))} style={{ width: `${clamped}%` }} />
      </div>
    );
  }
);
Progress.displayName = "Progress";
