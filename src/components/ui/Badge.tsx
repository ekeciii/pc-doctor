import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md font-semibold border whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-border",
        soft: "bg-primary-soft text-primary-strong border-primary/20",
        destructive: "bg-destructive text-destructive-foreground border-transparent",
        "destructive-soft": "bg-destructive-soft text-destructive-strong border-destructive/20",
        warning: "bg-warning text-warning-foreground border-transparent",
        "warning-soft": "bg-warning-soft text-warning-strong border-warning/20",
        success: "bg-success text-success-foreground border-transparent",
        "success-soft": "bg-success-soft text-success-strong border-success/20",
        info: "bg-info text-info-foreground border-transparent",
        "info-soft": "bg-info-soft text-info-strong border-info/20",
        outline: "bg-transparent border-border text-foreground",
      },
      size: {
        sm: "text-[10px] px-1.5 py-0.5 tracking-wide uppercase",
        default: "text-xs px-2 py-0.5",
        lg: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
);
Badge.displayName = "Badge";
