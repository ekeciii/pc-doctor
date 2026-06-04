import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** Optional aria-label when there is no DialogTitle (rare). */
  ariaLabel?: string;
}

/**
 * Modal dialog with:
 * - Escape key to close
 * - Focus trap (Tab/Shift+Tab cycle inside content)
 * - Initial focus on first focusable + focus restore on close
 * - role="dialog" + aria-modal="true"
 * - body scroll lock while open
 */
export function Dialog({ open, onOpenChange, children, ariaLabel }: DialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const labelledById = useId();

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;

    // Body scroll lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Initial focus — Sprint 9 review H3 fix: önce `[data-autofocus]` ara
    // (destructive default focus YASAK invariant'ı için caller'a kontrol verir),
    // bulamazsa first tabbable element'e düş.
    requestAnimationFrame(() => {
      const root = contentRef.current;
      if (!root) return;
      const explicit = root.querySelector<HTMLElement>("[data-autofocus]");
      const fallback = root.querySelector<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      (explicit ?? fallback ?? root).focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange?.(false);
        return;
      }
      if (e.key === "Tab" && contentRef.current) {
        // Focus trap
        const root = contentRef.current;
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (focusable.length === 0) {
          e.preventDefault();
          root.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to previously focused element
      previousFocus.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => onOpenChange?.(false)}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : labelledById}
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-dialog-labelled-by={labelledById}
      >
        {children}
      </div>
    </div>
  );
}

interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg" | "xl";
}

export function DialogContent({
  className,
  size = "default",
  ...props
}: DialogContentProps) {
  const widthClass = {
    sm: "w-[min(420px,94vw)]",
    default: "w-[min(540px,94vw)]",
    lg: "w-[min(680px,94vw)]",
    xl: "w-[min(800px,94vw)]",
  }[size];
  return (
    <div
      className={cn(
        widthClass,
        "max-h-[90vh] rounded-xl bg-card text-card-foreground",
        "shadow-2xl border border-border",
        "flex flex-col animate-rise-in",
        className
      )}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-5 border-b border-border",
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "font-display text-xl font-bold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground leading-relaxed", className)} {...props} />
  );
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 min-h-0 p-5 overflow-auto", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-5 border-t border-border flex justify-end gap-3",
        className
      )}
      {...props}
    />
  );
}
