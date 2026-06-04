import { ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import type { CleanupTarget } from "@/lib/types";
import { useByteFmt, useT } from "@/lib/i18n";
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

interface Props {
  open: boolean;
  targets: CleanupTarget[];
  totalBytes: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FixAllConfirmDialog({
  open,
  targets,
  totalBytes,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const fmtBytes = useByteFmt();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <span className="shrink-0 w-11 h-11 rounded-md bg-primary-soft text-primary-strong flex items-center justify-center">
            <Wand2 className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <DialogTitle>{t("fixAllCta")}</DialogTitle>
            <DialogDescription className="mt-1">{t("fixAllConfirmIntro")}</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex items-baseline justify-between rounded-lg bg-muted/50 border border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("fixAllConfirmTargets", { count: targets.length })}
            </span>
            <span className="font-mono font-semibold tabular-nums text-success-strong">
              {fmtBytes(totalBytes)}
            </span>
          </div>

          <ul className="text-sm space-y-1.5 max-h-44 overflow-auto">
            {targets.map((tg) => (
              <li key={tg.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-primary shrink-0">›</span>
                  <span className="truncate text-foreground/90">{tg.label}</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                  {fmtBytes(tg.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 shrink-0 text-success" />
            {t("fixAllConfirmRestoreNote")}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="gap-2">
            {busy ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Wand2 className="w-4 h-4" />}
            {t("fixAllCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
