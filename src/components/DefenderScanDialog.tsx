import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, X } from "lucide-react";
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
import { Card } from "./ui/Card";
import {
  NeedsElevationError,
  onDefenderScanComplete,
  onDefenderScanStart,
  runDefenderQuickScan,
} from "@/lib/api";
import type { DefenderScanResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onNeedsElevation: (reason: string) => void;
}

export function DefenderScanDialog({ open, onClose, onNeedsElevation }: Props) {
  const t = useT();
  const [running, setRunning] = useState(true);
  const [result, setResult] = useState<DefenderScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRunning(true);
      setResult(null);
      setError(null);
      return;
    }

    let unlistenStart: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      unlistenStart = await onDefenderScanStart(() => {
        if (!cancelled) setRunning(true);
      });
      unlistenComplete = await onDefenderScanComplete((r) => {
        if (!cancelled) {
          setResult(r);
          setRunning(false);
        }
      });

      try {
        await runDefenderQuickScan();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof NeedsElevationError) {
          onNeedsElevation(e.message);
          onClose();
          return;
        }
        setError(String(e));
        setRunning(false);
      }
    })();

    return () => {
      cancelled = true;
      unlistenStart?.();
      unlistenComplete?.();
    };
  }, [open, onClose, onNeedsElevation]);

  const threats = result?.threatsFound ?? [];
  const status: "running" | "error" | "threats" | "clean" = running
    ? "running"
    : error
      ? "error"
      : threats.length > 0
        ? "threats"
        : "clean";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <div
            className={cn(
              "w-12 h-12 rounded-md flex items-center justify-center shrink-0",
              status === "clean"
                ? "bg-success-soft text-success-strong"
                : status === "threats" || status === "error"
                  ? "bg-destructive-soft text-destructive-strong"
                  : "bg-primary-soft text-primary-strong"
            )}
          >
            {status === "running" ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : status === "error" ? (
              <X className="w-7 h-7" />
            ) : status === "threats" ? (
              <ShieldAlert className="w-7 h-7" />
            ) : (
              <CheckCircle2 className="w-7 h-7" />
            )}
          </div>
          <div className="flex-1">
            <DialogTitle>
              {status === "running"
                ? t("defenderRunning")
                : status === "error"
                  ? t("defenderScanFailed")
                  : t("defenderComplete")}
            </DialogTitle>
            {status === "running" && (
              <DialogDescription className="mt-1">{t("defenderRunningHint")}</DialogDescription>
            )}
            {(status === "clean" || status === "threats") && result && (
              <DialogDescription className="mt-1">
                {t("defenderDuration")}: {Math.floor(result.durationSeconds / 60)} dk{" "}
                {result.durationSeconds % 60} sn
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <DialogBody>
          {status === "running" && (
            <Alert variant="info">
              <AlertTitle>{t("defenderRunningHint")}</AlertTitle>
            </Alert>
          )}

          {status === "clean" && (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>{t("defenderNoThreats")}</AlertTitle>
            </Alert>
          )}

          {status === "threats" && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <ShieldAlert />
                <AlertTitle>
                  {threats.length} {t("defenderThreatsFound")}
                </AlertTitle>
              </Alert>
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("defenderThreatList")}
              </h3>
              <ul className="space-y-2">
                {threats.map((th, i) => (
                  <li key={i}>
                    <Card variant="default">
                      <div className="p-3.5">
                        <div className="font-display font-semibold text-foreground">
                          {th.threatName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t("statusLabel")}:{" "}
                          <span className="font-medium text-foreground/85">{th.status}</span>
                          {th.processName ? (
                            <>
                              {" · "}
                              {t("processLabel")}:{" "}
                              <span className="font-mono text-foreground/85">
                                {th.processName}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "error" && error && (
            <Alert variant="destructive">
              <X />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {t("defenderClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
