import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Alert, AlertTitle } from "./ui/Alert";
import { Progress } from "./ui/Progress";
import {
  NeedsElevationError,
  onSfcDismComplete,
  onSfcDismProgress,
  runSystemFileCheck,
} from "@/lib/api";
import type { ProgressLine, SfcDismSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onNeedsElevation: (reason: string) => void;
}

const MAX_LINES = 30;

export function SfcDismProgressDialog({ open, onClose, onNeedsElevation }: Props) {
  const t = useT();
  const [phase, setPhase] = useState<"DISM" | "SFC" | "done" | "error">("DISM");
  const [percent, setPercent] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [summary, setSummary] = useState<SfcDismSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setPhase("DISM");
      setPercent(null);
      setLines([]);
      setSummary(null);
      setError(null);
      return;
    }

    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      unlistenProgress = await onSfcDismProgress((line: ProgressLine) => {
        if (cancelled) return;
        setPhase(line.phase);
        if (line.percent !== null) setPercent(line.percent);
        setLines((prev) => {
          const next = [...prev, `[${line.phase}] ${line.text}`];
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
        });
      });
      unlistenComplete = await onSfcDismComplete((s) => {
        if (cancelled) return;
        setSummary(s);
        setPhase("done");
      });

      try {
        await runSystemFileCheck();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof NeedsElevationError) {
          onNeedsElevation(e.message);
          onClose();
          return;
        }
        setError(String(e));
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      unlistenProgress?.();
      unlistenComplete?.();
    };
  }, [open, onClose, onNeedsElevation]);

  useEffect(() => {
    linesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const running = phase === "DISM" || phase === "SFC";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <div
            className={cn(
              "w-11 h-11 rounded-md flex items-center justify-center shrink-0",
              phase === "done"
                ? "bg-success-soft text-success-strong"
                : phase === "error"
                  ? "bg-destructive-soft text-destructive-strong"
                  : "bg-primary-soft text-primary-strong"
            )}
          >
            {phase === "done" ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : phase === "error" ? (
              <X className="w-6 h-6" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin" />
            )}
          </div>
          <div className="flex-1">
            <DialogTitle>
              {phase === "done"
                ? t("sfcComplete")
                : phase === "error"
                  ? t("sfcSfcFailed")
                  : t("sfcRunning")}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {phase === "DISM"
                ? t("sfcPhaseDism")
                : phase === "SFC"
                  ? t("sfcPhaseSfc")
                  : phase === "done"
                    ? ""
                    : t("sfcSfcFailed")}
            </DialogDescription>
          </div>
          {percent !== null && running && (
            <div className="font-display text-2xl font-bold text-primary tabular-nums">
              %{percent}
            </div>
          )}
        </DialogHeader>

        {percent !== null && running && (
          <div className="px-5 pt-3">
            <Progress value={percent} tone="primary" size="lg" />
          </div>
        )}

        <DialogBody className="flex flex-col gap-3">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("sfcLogTitle")}
          </h3>
          <div className="flex-1 min-h-[12rem] rounded-md bg-foreground/95 text-background/90 p-3.5 text-xs font-mono overflow-auto leading-relaxed">
            {lines.length === 0 && (
              <div className="text-background/40">{t("sfcRunning")}…</div>
            )}
            {lines.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {l}
              </div>
            ))}
            <div ref={linesEnd} />
          </div>

          {summary && phase === "done" && (
            <Alert
              variant={
                summary.sfcRepairedFiles
                  ? "success"
                  : summary.sfcOk && summary.dismOk
                    ? "info"
                    : "warning"
              }
            >
              <AlertTitle>
                {summary.sfcRepairedFiles
                  ? t("sfcRepairedFiles")
                  : summary.sfcOk && summary.dismOk
                    ? t("sfcNoRepairsNeeded")
                    : !summary.dismOk
                      ? t("sfcDismFailed")
                      : t("sfcSfcFailed")}
              </AlertTitle>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {t("sfcClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
