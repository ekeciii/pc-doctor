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
  bodyLines: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, bodyLines, onConfirm, onCancel }: Props) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="w-11 h-11 rounded-md bg-warning-soft text-warning-strong flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription className="mt-1">{t("confirmIntro")}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>
          <ul className="text-sm space-y-1.5 rounded-md bg-muted/50 p-3.5 border border-border">
            {bodyLines.map((line, i) => (
              <li key={i} className="text-foreground/90 flex gap-2">
                <span className="text-primary shrink-0">›</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("confirmAction")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
