import { useEffect, useRef, useState } from "react";
import { AlertOctagon } from "lucide-react";
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
import { abortChkdskReboot, cancelPendingChkdsk, scheduleChkdskReboot } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  volume: string;
  initialSeconds?: number;
  onAbort: () => void;
  onClose: () => void;
}

/**
 * Sprint 8 — reboot countdown dialog (invariant #21-23).
 *
 * - aria-live="polite" her 10 sn; son 10 sn role="alert" assertive.
 * - Default focus "Vazgeç" butonuna.
 * - Initial seconds clamp 60..600.
 */
export function ChkdskRebootCountdownDialog({
  open,
  volume,
  initialSeconds = 120,
  onAbort,
  onClose,
}: Props) {
  const t = useT();
  const clamped = Math.min(600, Math.max(60, initialSeconds));
  const [remaining, setRemaining] = useState(clamped);
  const [aborting, setAborting] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Reboot'u schedule et + countdown başlat
  useEffect(() => {
    if (!open) return;
    setRemaining(clamped);
    let cancelled = false;
    scheduleChkdskReboot(clamped).catch((e) => {
      if (!cancelled) console.error("[chkdsk] reboot schedule failed:", e);
    });
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => {
      cancelled = true;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [open, clamped]);

  const handleAbort = async () => {
    if (aborting) return; // Re-entry guard (H4 fix)
    setAborting(true);
    try {
      await abortChkdskReboot();
      await cancelPendingChkdsk(volume);
    } catch (e) {
      console.warn("[chkdsk] abort error:", e);
    }
    onAbort();
    onClose();
  };

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const countdownStr = `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  const isCritical = remaining <= 10;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !aborting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div
            className={cn(
              "w-11 h-11 rounded-md flex items-center justify-center shrink-0",
              isCritical
                ? "bg-destructive-soft text-destructive-strong"
                : "bg-warning-soft text-warning-strong"
            )}
            aria-hidden="true"
          >
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <DialogTitle>{t("chkdskRebootCountdownTitle", { volume })}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("chkdskRebootCountdownBody")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>
          {/* Sprint 9 H4 + Sprint 10 review H5 fix: iki AYRI sr-only live region.
              Aynı element üzerinde aria-live attribute swap (polite↔assertive) yapmak NVDA/JAWS'ta
              boundary anonsu kaçırır. İki kalıcı region; ilgisiz biri boş tutulur. */}
          <div
            className={cn(
              "text-center py-6 font-display font-extrabold tabular-nums",
              isCritical ? "text-destructive text-6xl animate-pulse" : "text-foreground text-5xl"
            )}
            aria-hidden="true"
          >
            {countdownStr}
          </div>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {!isCritical && remaining % 10 === 0
              ? t("chkdskRebootCountdownAnnounce", { seconds: remaining })
              : ""}
          </div>
          <div className="sr-only" aria-live="assertive" aria-atomic="true">
            {isCritical
              ? t("chkdskRebootCountdownAnnounce", { seconds: remaining })
              : ""}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {t("chkdskRebootCountdownHint")}
          </p>
        </DialogBody>
        <DialogFooter>
          {/* Sprint 10 review H4 fix: disabled yerine aria-busy + aria-disabled ki focus trap
              boş kalmasın (focus trap deadlock + ESC işlemez riski). handleAbort re-entry guard. */}
          <Button
            variant="destructive"
            onClick={handleAbort}
            aria-busy={aborting}
            aria-disabled={aborting}
            data-autofocus
          >
            {aborting ? t("chkdskRebootAborting") : t("chkdskRebootAbort")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
