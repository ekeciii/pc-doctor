import { CheckCircle2, X, Wrench } from "lucide-react";
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
import type { ChkdskFixResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useDuration } from "@/lib/duration";

interface Props {
  /** null iken kapalı; canlı /f tamamlandığında set edilir. */
  result: ChkdskFixResult | null;
  onClose: () => void;
}

/**
 * Sistem-dışı (canlı) chkdsk /f onarımının sonucunu kullanıcıya gösterir.
 * Önceden sonuç sadece console.info'ya yazılıyordu — kullanıcı hiçbir geri
 * bildirim almıyordu. Sistem sürücüsü akışı ayrı (reboot countdown) yürür.
 */
export function ChkdskFixResultDialog({ result, onClose }: Props) {
  const t = useT();
  const formatDuration = useDuration();
  if (!result) return null;

  const ok = result.status === "clean" || result.status === "repaired";
  const statusKey =
    result.status === "clean"
      ? "chkdskPostRebootStatus_clean"
      : result.status === "repaired"
        ? "chkdskPostRebootStatus_repaired"
        : result.status === "errorsFound"
          ? "chkdskPostRebootStatus_errorsFound"
          : "chkdskPostRebootStatus_unknown";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <div
            className={cn(
              "w-11 h-11 rounded-md flex items-center justify-center shrink-0",
              ok
                ? "bg-success-soft text-success-strong"
                : result.status === "errorsFound"
                  ? "bg-warning-soft text-warning-strong"
                  : "bg-muted text-muted-foreground"
            )}
            aria-hidden="true"
          >
            {ok ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : result.status === "errorsFound" ? (
              <Wrench className="w-6 h-6" />
            ) : (
              <X className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <DialogTitle>{t("chkdskFixLiveTitle", { volume: result.volume })}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("chkdskDuration")}: {formatDuration(result.durationSeconds)} · exit{" "}
              {result.exitCode}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <Alert variant={ok ? "success" : result.status === "errorsFound" ? "warning" : "info"}>
            <AlertTitle>{t(statusKey)}</AlertTitle>
          </Alert>

          {result.logTail && (
            <>
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("chkdskLogTitle")}
              </h3>
              <div
                className="max-h-[12rem] rounded-md bg-foreground/95 text-background/90 p-3.5 text-xs font-mono overflow-auto leading-relaxed whitespace-pre-wrap break-words"
                role="log"
              >
                {result.logTail}
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("chkdskClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
