import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { Button } from "./ui/Button";
import { fetchLastChkdskResult, queryPendingChkdsk } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { ChkdskBootResult } from "@/lib/types";

const DISMISS_KEY = "chkdsk-boot-result-dismissed-at";

/**
 * Sprint 8 — reboot sonrası autochk sonucu banner. Fail-soft.
 * Sprint 9 review H9 fix: volume artık hardcoded "C" değil; queryPendingChkdsk'ten
 * son scheduled volume okunur. Pending null ise fallback "C" (en yaygın system drive).
 */
export function ChkdskBootResultBanner() {
  const t = useT();
  const [result, setResult] = useState<ChkdskBootResult | null>(null);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;
    (async () => {
      // Önce pending kaydından son scheduled volume'ü al
      const pending = await queryPendingChkdsk();
      const targetVolume = pending?.volume ?? "C";
      const r = await fetchLastChkdskResult(targetVolume);
      if (r && r.status !== "unknown") setResult(r);
    })();
  }, []);

  if (!result) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, Date.now().toString());
    setResult(null);
  };

  const variant = result.status === "errorsFound" ? "warning" : "success";

  return (
    <Alert variant={variant} className="mb-4 items-start animate-fade-in">
      <CheckCircle2 />
      <div className="flex-1 min-w-0">
        <AlertTitle>
          {t("chkdskPostRebootBannerTitle", { volume: result.volume })}
        </AlertTitle>
        <AlertDescription className="mt-1">
          {t(`chkdskPostRebootStatus_${result.status}` as never)}
        </AlertDescription>
      </div>
      <div className="shrink-0">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {t("chkdskPostRebootDismiss")}
        </Button>
      </div>
    </Alert>
  );
}
