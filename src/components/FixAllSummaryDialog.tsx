import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import type { FixAllOutcome } from "@/lib/types";
import { useT } from "@/lib/i18n";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { Button } from "./ui/Button";

interface Props {
  outcome: FixAllOutcome | null;
  onClose: () => void;
}

export function FixAllSummaryDialog({ outcome, onClose }: Props) {
  const t = useT();
  if (!outcome) return null;

  const allOk = outcome.failed === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <span
            className={`shrink-0 w-11 h-11 rounded-md flex items-center justify-center ${
              allOk ? "bg-success-soft text-success-strong" : "bg-warning-soft text-warning-strong"
            }`}
          >
            {allOk ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </span>
          <DialogTitle>{t("fixAllSummaryTitle")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-2.5">
          <Row tone="success" icon={<CheckCircle2 className="w-4 h-4" />}>
            {t("fixAllSummaryApplied", { count: outcome.applied })}
          </Row>
          {outcome.failed > 0 && (
            <Row tone="warning" icon={<AlertTriangle className="w-4 h-4" />}>
              {t("fixAllSummaryFailed", { count: outcome.failed })}
            </Row>
          )}
          {outcome.rebootRequired.length > 0 && (
            <Row tone="info" icon={<RotateCcw className="w-4 h-4" />}>
              {t("fixAllSummaryReboot", { count: outcome.rebootRequired.length })}
            </Row>
          )}
          {outcome.restorePointCreated && (
            <Row tone="muted" icon={<ShieldCheck className="w-4 h-4" />}>
              {t("fixAllSummaryRestore")}
            </Row>
          )}
        </DialogBody>

        <DialogFooter>
          <Button data-autofocus onClick={onClose}>
            {t("guidedClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  tone,
  icon,
  children,
}: {
  tone: "success" | "warning" | "info" | "muted";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass = {
    success: "text-success-strong",
    warning: "text-warning-strong",
    info: "text-info-strong",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className={`flex items-center gap-2.5 text-sm ${toneClass}`}>
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
