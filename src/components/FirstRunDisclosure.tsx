import { ShieldCheck } from "lucide-react";
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
import { openOemLink } from "@/lib/api";
import { useT } from "@/lib/i18n";

const PRIVACY_URL = "https://github.com/ekeciii/pc-doctor/blob/main/PRIVACY.md";

interface Props {
  open: boolean;
  onAck: () => void;
}

/**
 * Faz 2 — ilk açılışta bir kez gösterilen veri-okuma bildirimi. Rıza duvarı DEĞİL
 * (tüm işlem zaten yerel) — sadece "ne okunuyor, nereye gidiyor" özetini kullanıcı
 * TARA'ya basmadan önce görsün diye. Onay `settings.disclosureAckVersion`'a yazılır;
 * bildirim metni değişirse `CURRENT_DISCLOSURE_VERSION` artırılır ve tekrar gösterilir.
 */
export function FirstRunDisclosure({ open, onAck }: Props) {
  const t = useT();

  const bullets = [
    t("disclosureBullet1"),
    t("disclosureBullet2"),
    t("disclosureBullet3"),
    t("disclosureBullet4"),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onAck()}>
      <DialogContent>
        <DialogHeader>
          <div className="w-11 h-11 rounded-md bg-info-soft text-info-strong flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <DialogTitle>{t("disclosureTitle")}</DialogTitle>
            <DialogDescription className="mt-1">{t("disclosureIntro")}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>
          <ul className="text-sm space-y-2 rounded-md bg-muted/50 p-3.5 border border-border">
            {bullets.map((line, i) => (
              <li key={i} className="text-foreground/90 flex gap-2">
                <span className="text-primary shrink-0">›</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2.5">
            {t("disclosureLinkPrefix")}
            <button
              type="button"
              onClick={() => {
                openOemLink(PRIVACY_URL).catch(() => {});
              }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t("settingsPrivacyLink")}
            </button>
          </p>
        </DialogBody>
        <DialogFooter>
          <Button data-autofocus onClick={onAck}>
            {t("disclosureAck")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
