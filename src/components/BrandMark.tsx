import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BrandMark({ className, size = "md" }: Props) {
  const dim = size === "lg" ? 40 : size === "md" ? 28 : 20;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="36" height="36" rx="11" className="fill-primary" />
      <path
        d="M6 22 H13 L15 16 L18 28 L21 14 L24 24 L26 22 H34"
        className="stroke-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function BrandLockup({ subtle }: { subtle?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size="lg" />
      <div className="flex flex-col leading-tight">
        <span className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          PC Doctor
        </span>
        {!subtle && (
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Sistem nabzı
          </span>
        )}
      </div>
    </div>
  );
}
