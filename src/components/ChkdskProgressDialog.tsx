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
import { invoke } from "@tauri-apps/api/core";
import {
  NeedsElevationError,
  onChkdskComplete,
  onChkdskProgress,
  runChkdskScan,
} from "@/lib/api";
import type { ChkdskProgress, ChkdskResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  volume: string | null;
  onClose: () => void;
  onNeedsElevation: (reason: string) => void;
}

const MAX_LINES = 30;

const STAGE_LABEL_KEYS = [
  "chkdskStage0",
  "chkdskStage1",
  "chkdskStage2",
  "chkdskStage3",
  "chkdskStage4",
  "chkdskStage5",
] as const;

type Phase = "running" | "done" | "error" | "cancelled";

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m} dk ${sec} sn`;
}

export function ChkdskProgressDialog({ open, volume, onClose, onNeedsElevation }: Props) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("running");
  const [stage, setStage] = useState(0);
  const [percent, setPercent] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [result, setResult] = useState<ChkdskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const linesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !volume) {
      setPhase("running");
      setStage(0);
      setPercent(null);
      setLines([]);
      setResult(null);
      setError(null);
      setCancelling(false);
      return;
    }

    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      // Listener'ları SCAN'i başlatmadan önce kur — race-free.
      try {
        const [up, uc] = await Promise.all([
          onChkdskProgress((p: ChkdskProgress) => {
            if (cancelled) return;
            setStage(p.stage);
            if (p.percent !== null) setPercent(p.percent);
            setLines((prev) => {
              const next = [...prev, p.text];
              return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
            });
          }),
          onChkdskComplete((r) => {
            if (cancelled) return;
            setResult(r);
          }),
        ]);
        if (cancelled) {
          up();
          uc();
          return;
        }
        unlistenProgress = up;
        unlistenComplete = uc;

        try {
          // Success path'i event'e değil promise'e bağla — emit() fail ederse UI takılmasın.
          const r = await runChkdskScan(volume);
          if (cancelled) return;
          setResult(r);
          setPhase(r.status === "cancelled" ? "cancelled" : "done");
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
      } catch (e) {
        if (cancelled) return;
        setError(`Listener kurulamadı: ${String(e)}`);
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      unlistenProgress?.();
      unlistenComplete?.();
    };
  }, [open, volume, onClose, onNeedsElevation]);

  useEffect(() => {
    linesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const running = phase === "running";
  const stageKey = STAGE_LABEL_KEYS[Math.min(stage, STAGE_LABEL_KEYS.length - 1)];

  const handleCancel = async () => {
    setCancelling(true);
    try {
      // Sprint 13 — signature ChkdskCancelOutcome; tip değişimi geriye uyumlu (sadece tüketmiyoruz)
      await invoke("cancel_chkdsk_scan");
    } catch {
      /* sessizce yut */
    }
    // Backend child.kill() → reader EOF → result Cancelled olarak gelir.
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <div
            className={cn(
              "w-11 h-11 rounded-md flex items-center justify-center shrink-0",
              phase === "done"
                ? result?.errorsFound
                  ? "bg-warning-soft text-warning-strong"
                  : "bg-success-soft text-success-strong"
                : phase === "cancelled"
                  ? "bg-muted text-muted-foreground"
                  : phase === "error"
                    ? "bg-destructive-soft text-destructive-strong"
                    : "bg-primary-soft text-primary-strong"
            )}
            aria-hidden="true"
          >
            {phase === "done" ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : phase === "error" || phase === "cancelled" ? (
              <X className="w-6 h-6" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin" />
            )}
          </div>
          <div className="flex-1">
            <DialogTitle>
              {phase === "done"
                ? t("chkdskComplete")
                : phase === "cancelled"
                  ? t("chkdskCancelled")
                  : phase === "error"
                    ? t("chkdskFailed")
                    : t("chkdskRunning", { volume: volume ?? "" })}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {phase === "running"
                ? t(stageKey)
                : result
                  ? `${t("chkdskDuration")}: ${formatDuration(result.durationSeconds)} · exit ${result.exitCode}`
                  : ""}
            </DialogDescription>
          </div>
          {percent !== null && running && (
            <div
              className="font-display text-2xl font-bold text-primary tabular-nums"
              aria-hidden="true"
            >
              %{percent}
            </div>
          )}
        </DialogHeader>

        {percent !== null && running && (
          <div className="px-5 pt-3">
            <Progress
              value={percent}
              tone="primary"
              size="lg"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t(stageKey)}
            />
          </div>
        )}

        <DialogBody className="flex flex-col gap-3">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("chkdskLogTitle")}
          </h3>
          <div
            className="flex-1 min-h-[12rem] rounded-md bg-foreground/95 text-background/90 p-3.5 text-xs font-mono overflow-auto leading-relaxed"
            role="log"
            aria-live="polite"
            aria-atomic="false"
          >
            {lines.length === 0 && (
              <div className="text-background/40">{t("chkdskRunning", { volume: volume ?? "" })}…</div>
            )}
            {lines.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {l}
              </div>
            ))}
            <div ref={linesEnd} />
          </div>

          {result && phase === "done" && (
            <Alert variant={result.errorsFound ? "warning" : "success"}>
              <AlertTitle>
                {result.errorsFound
                  ? t("chkdskErrorsFound")
                  : t("chkdskNoErrors")}
              </AlertTitle>
            </Alert>
          )}

          {phase === "cancelled" && (
            <Alert variant="info">
              <AlertTitle>{t("chkdskCancelledBody")}</AlertTitle>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          {running ? (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? t("chkdskCancelling") : t("chkdskCancel")}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              {t("chkdskClose")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
