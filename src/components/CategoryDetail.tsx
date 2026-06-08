import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { Finding } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { FindingCard } from "./FindingCard";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { cn } from "@/lib/utils";
import type { CategoryDef } from "./categoryDefs";

interface Props {
  category: CategoryDef | null;
  findings: Finding[];
  onBack: () => void;
  onSystemFileCheck: (f: Finding) => void;
  onDefenderQuickScan: (f: Finding) => void;
  onChkdskScan: (f: Finding, volume: string) => void;
  onChkdskFix: (f: Finding, volume: string, isSystem: boolean) => void;
  onGuided: (f: Finding) => void;
  onApplyFix: (f: Finding) => void;
}

/** Yandan kayan kategori detay paneli — o kategorinin bulguları + düzeltmeleri. */
export function CategoryDetail({
  category,
  findings,
  onBack,
  onSystemFileCheck,
  onDefenderQuickScan,
  onChkdskScan,
  onChkdskFix,
  onGuided,
  onApplyFix,
}: Props) {
  const t = useT();
  if (!category) return null;
  const Icon = category.icon;

  return (
    <div className="flex flex-col h-full">
      {/* başlık */}
      <div className="flex items-center gap-3 px-1 pb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className={cn(
            "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
            "border border-border bg-card/60 backdrop-blur-sm text-foreground",
            "hover:-translate-x-0.5 hover:border-primary/40 transition-[transform,border-color]"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="shrink-0 w-10 h-10 rounded-md bg-primary-soft/70 text-primary-strong flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground truncate">
            {category.label}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {t("categoryCount", { count: findings.length })}
          </p>
        </div>
      </div>

      {/* bulgular (panel içi scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
        {findings.length === 0 ? (
          <Alert variant="success">
            <CheckCircle2 />
            <div>
              <AlertTitle>{t("scanHealthyTitle")}</AlertTitle>
              <AlertDescription className="mt-1">{t("scanHealthyBody")}</AlertDescription>
            </div>
          </Alert>
        ) : (
          findings.map((f, i) => (
            <FindingCard
              key={f.id}
              finding={f}
              index={i}
              onSystemFileCheck={onSystemFileCheck}
              onDefenderQuickScan={onDefenderQuickScan}
              onChkdskScan={onChkdskScan}
              onChkdskFix={onChkdskFix}
              onGuided={onGuided}
              onApplyFix={onApplyFix}
            />
          ))
        )}
      </div>
    </div>
  );
}
