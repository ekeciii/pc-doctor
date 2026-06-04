import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { Button } from "./ui/Button";
import {
  cancelPendingChkdsk,
  checkChkdskScheduledVolumes,
  queryPendingChkdsks,
  ScheduleInconsistentError,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { PendingChkdsk } from "@/lib/types";

interface Props {
  /** Reboot countdown başlat — App.tsx state machine'e callback */
  onRequestReboot: (volume: string) => void;
  /**
   * Sprint 10 review H2 + Sprint 11 review H1+H4:
   * chkntfs /x fail → App.tsx persistent destructive Alert.
   * Required (not optional) — eksik wiring compile-time hatası verir.
   */
  onScheduleInconsistent: (volume: string, message: string) => void;
}

/**
 * Sprint 8 — pending schedule banner.
 * Sprint 12 H6-UI — multi-volume: kullanıcı C: + D: ayrı banner görür, bağımsız aksiyon.
 *
 * Backend (Sprint 11) Vec<PendingChkdsk> döner. Her volume için ayrı kart;
 * dismiss state sessionStorage'da per-volume tutulur.
 */
export function ChkdskPendingBanner({
  onRequestReboot,
  onScheduleInconsistent,
}: Props) {
  const t = useT();
  const [pendings, setPendings] = useState<PendingChkdsk[]>([]);
  const [dismissedVolumes, setDismissedVolumes] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Sprint 9 H7 + Sprint 11 H6 UI: önce JSON multi-volume oku, boşsa registry crosscheck.
    (async () => {
      const jsonPendings = await queryPendingChkdsks();
      if (jsonPendings.length > 0) {
        setPendings(jsonPendings);
        return;
      }
      // App crash recovery: registry'de scheduled olup JSON'da olmayanlar
      const registryScheduled = await checkChkdskScheduledVolumes();
      if (registryScheduled.length > 0) {
        const nowIso = new Date().toISOString();
        setPendings(
          registryScheduled.map((volume) => ({
            volume,
            scheduledAt: nowIso,
            rebootPending: false,
          }))
        );
      }
    })();
  }, []);

  const visiblePendings = pendings.filter((p) => !dismissedVolumes.has(p.volume));
  if (visiblePendings.length === 0) return null;

  const dismissVolume = (volume: string) => {
    setDismissedVolumes((prev) => {
      const next = new Set(prev);
      next.add(volume);
      return next;
    });
  };

  const handleCancel = async (volume: string) => {
    try {
      await cancelPendingChkdsk(volume);
      setPendings((prev) => prev.filter((p) => p.volume !== volume));
    } catch (e) {
      if (e instanceof ScheduleInconsistentError) {
        console.error(
          "[chkdsk] schedule inconsistent — manual chkntfs /x required",
          volume,
          e.message
        );
        onScheduleInconsistent(volume, e.message);
      } else {
        console.warn("[chkdsk] cancel pending failed:", e);
      }
    }
  };

  return (
    <>
      {visiblePendings.map((pending) => (
        <Alert
          key={pending.volume}
          variant="warning"
          className="mb-4 items-start animate-fade-in"
        >
          <AlertTriangle />
          <div className="flex-1 min-w-0">
            <AlertTitle>
              {t("chkdskPendingBannerTitle", { volume: pending.volume })}
            </AlertTitle>
            <AlertDescription className="mt-1">
              {t("chkdskPendingBannerBody", { volume: pending.volume })}
            </AlertDescription>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              variant="warning"
              size="default"
              onClick={() => onRequestReboot(pending.volume)}
            >
              {t("chkdskPendingRebootNow")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleCancel(pending.volume)}>
              {t("chkdskPendingCancel")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissVolume(pending.volume)}
            >
              {t("chkdskPendingLater")}
            </Button>
          </div>
        </Alert>
      ))}
    </>
  );
}
