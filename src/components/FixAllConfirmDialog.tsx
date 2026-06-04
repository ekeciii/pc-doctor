import { ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { useT } from "@/lib/i18n";
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
  /** Uygulanacak fix'lerin okunabilir etiketleri. */
  lines: string[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FixAllConfirmDialog({ open, lines, busy, onConfirm, onCancel }: Props) {
  const t = useT();

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
          <ul className="text-sm space-y-1.5 rounded-md bg-muted/50 p-3.5 border border-border max-h-52 overflow-auto">
            {lines.map((line, i) => (
              <li key={i} className="text-foreground/90 flex gap-2">
                <span className="text-primary shrink-0">›</span>
                <span>{line}</span>
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
