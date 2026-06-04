import { useState } from "react";
import { ShieldAlert } from "lucide-react";
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
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  volume: string;
  isSystem: boolean;
  onConfirm: (force: boolean) => void;
  onCancel: () => void;
}

/**
 * Sprint 8 — chkdsk /f onay dialogu.
 *
 * Default focus "Vazgeç" butonuna (invariant #22: destructive default focus YASAK).
 * System variant: reboot uyarısı + 5 bullet. Non-system: "kullanım dışı olmalı" uyarısı.
 */
export function ChkdskFixConfirmDialog({
  open,
  volume,
  isSystem,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const [force, setForce] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="w-11 h-11 rounded-md bg-warning-soft text-warning-strong flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <DialogTitle>
              {isSystem
                ? t("chkdskFixConfirmTitleSystem", { volume })
                : t("chkdskFixConfirmTitleData", { volume })}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {isSystem
                ? t("chkdskFixConfirmLeadSystem", { volume })
                : t("chkdskFixConfirmLeadData", { volume })}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>
          <ul className="text-sm space-y-1.5 rounded-md bg-muted/50 p-3.5 border border-border">
            {(isSystem
              ? [
                  t("chkdskFixBulletDuration"),
                  t("chkdskFixBulletRebootRequired"),
                  t("chkdskFixBulletUnsavedLoss"),
                  t("chkdskFixBulletRestorePoint"),
                  t("chkdskFixBulletAutochkSequence"),
                ]
              : [
                  t("chkdskFixBulletDuration"),
                  t("chkdskFixBulletVolumeLock"),
                  t("chkdskFixBulletRestorePoint"),
                ]
            ).map((line, i) => (
              <li key={i} className="text-foreground/90 flex gap-2">
                <span className="text-primary shrink-0">›</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 mt-4 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="w-3.5 h-3.5 accent-warning cursor-pointer"
            />
            <span>{t("chkdskFixForceWithoutRestore")}</span>
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} data-autofocus>
            {t("cancel")}
          </Button>
          <Button variant="warning" onClick={() => onConfirm(force)}>
            {t("confirmAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
