import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { Progress } from "./ui/Progress";
import { onDefenderScanStart, onFixAllProgress, onSfcDismProgress } from "@/lib/api";
import type { ProgressLine } from "@/lib/types";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";

interface Props {
  /** App'in `fixingAll` state'i — batch çalışırken true. */
  open: boolean;
}

const MAX_LINES = 18;

/** FixSpec.id() → kısa adım etiketi i18n key'i. */
const STEP_LABEL: Record<string, TKey> = {
  cleanup: "fixStepCleanup",
  enableFirewall: "fixStepFirewall",
  enableUac: "fixStepUac",
  setPagefileManaged: "fixStepPagefile",
  defenderQuickScan: "fixStepDefender",
  systemFileCheck: "fixStepSystemFiles",
};

export function FixAllProgressDialog({ open }: Props) {
  const t = useT();
  const [stepId, setStepId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [percent, setPercent] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const linesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setStepId(null);
      setIndex(0);
      setTotal(0);
      setPercent(null);
      setLines([]);
      return;
    }

    let unFix: (() => void) | null = null;
    let unSfc: (() => void) | null = null;
    let unDef: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      unFix = await onFixAllProgress((p) => {
        if (cancelled) return;
        setStepId(p.id);
        setIndex(p.index);
        setTotal(p.total);
        setPercent(null);
        setLines([]);
      });
      unSfc = await onSfcDismProgress((line: ProgressLine) => {
        if (cancelled) return;
        if (line.percent !== null) setPercent(line.percent);
        setLines((prev) => {
          const next = [...prev, `[${line.phase}] ${line.text}`];
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
        });
      });
      unDef = await onDefenderScanStart(() => {
        if (cancelled) return;
        setLines((prev) => [...prev, t("fixStepDefenderRunning")]);
      });
    })();

    return () => {
      cancelled = true;
      unFix?.();
      unSfc?.();
      unDef?.();
    };
  }, [open, t]);

  useEffect(() => {
    linesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const stepLabel = stepId
    ? t(STEP_LABEL[stepId] ?? "fixAllProgressWorking")
    : t("fixAllProgressWorking");
  const isHeavy = stepId === "systemFileCheck" || stepId === "defenderQuickScan";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent size="lg">
        <DialogHeader>
          <span className="w-11 h-11 rounded-md flex items-center justify-center shrink-0 bg-primary-soft text-primary-strong">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </span>
          <div className="flex-1 min-w-0">
            <DialogTitle>{t("fixAllProgressTitle")}</DialogTitle>
            <DialogDescription className="mt-1">
              {total > 0 ? t("fixAllProgressStep", { index: index + 1, total }) : ""}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">{stepLabel}</span>
          </div>

          {percent !== null && <Progress value={percent} />}

          {isHeavy && (
            <div className="min-h-[10rem] max-h-56 rounded-md bg-foreground/95 text-background/90 p-3.5 text-xs font-mono overflow-auto leading-relaxed">
              {lines.length === 0 ? (
                <div className="text-background/40">{t("fixStepHeavyWait")}…</div>
              ) : (
                lines.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    {l}
                  </div>
                ))
              )}
              <div ref={linesEnd} />
            </div>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            {isHeavy ? (
              <Wrench className="w-4 h-4 shrink-0 text-warning-strong" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 text-success" />
            )}
            {t("fixAllProgressHint")}
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
