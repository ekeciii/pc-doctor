import { ArrowUpRight, Compass } from "lucide-react";
import type { Finding } from "@/lib/types";
import { resolveFinding, useI18n, useT } from "@/lib/i18n";
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
  finding: Finding | null;
  /** İlgili Windows ayarını / OEM linkini açar (App action'a göre yönlendirir). */
  onOpenTarget: (finding: Finding) => void;
  onClose: () => void;
}

export function GuidedFixDrawer({ finding, onOpenTarget, onClose }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const resolved = finding ? resolveFinding(finding, locale) : null;
  const hasTarget =
    finding?.action?.type === "openUrl" ||
    finding?.action?.type === "openSystemPropertiesPerformance";

  return (
    <Dialog open={!!finding} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="default">
        <DialogHeader>
          <span className="shrink-0 w-10 h-10 rounded-md bg-info-soft text-info-strong flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <DialogTitle>{resolved?.title || t("guidedDrawerTitle")}</DialogTitle>
            <DialogDescription className="mt-1">{resolved?.description}</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {t("guidedStepsTitle")}
          </p>
          <ol className="space-y-3">
            {resolved?.recommendedAction && <Step n={1}>{resolved.recommendedAction}</Step>}
            {hasTarget ? (
              <>
                <Step n={resolved?.recommendedAction ? 2 : 1}>{t("guidedStepOpen")}</Step>
                <Step n={resolved?.recommendedAction ? 3 : 2}>{t("guidedStepApply")}</Step>
              </>
            ) : (
              <Step n={resolved?.recommendedAction ? 2 : 1}>{t("guidedStepManual")}</Step>
            )}
          </ol>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("guidedClose")}
          </Button>
          {hasTarget && finding && (
            <Button data-autofocus onClick={() => onOpenTarget(finding)}>
              <ArrowUpRight className="w-4 h-4" />
              {t("guidedOpenSetting")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-primary-soft text-primary-strong font-mono text-xs font-semibold flex items-center justify-center">
        {n}
      </span>
      <span className="text-sm text-foreground/90 leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}
