import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { Button } from "./ui/Button";
import { relaunchAsAdmin, toError } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Props {
  isElevated: boolean;
  forceShow?: boolean;
  reason?: string;
}

export function ElevationBanner({ isElevated, forceShow, reason }: Props) {
  const t = useT();
  if (isElevated && !forceShow) return null;

  const handle = async () => {
    try {
      await relaunchAsAdmin();
    } catch (e) {
      alert(`${t("relaunchFailed")}: ${toError(e).message}`);
    }
  };

  return (
    <Alert variant="warning" className="mb-5 items-center animate-fade-in">
      <ShieldAlert />
      <div className="flex-1 min-w-0">
        <AlertTitle>{forceShow ? t("elevationRequired") : t("elevationRecommended")}</AlertTitle>
        <AlertDescription className="mt-1">{reason || t("elevationExplain")}</AlertDescription>
      </div>
      <Button variant="warning" size="default" onClick={handle} className="shrink-0">
        {t("relaunchAsAdmin")}
      </Button>
    </Alert>
  );
}
