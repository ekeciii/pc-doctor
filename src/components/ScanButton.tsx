import { Activity, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Props {
  scanning: boolean;
  hasReport: boolean;
  onClick: () => void;
}

export function ScanButton({ scanning, hasReport, onClick }: Props) {
  const t = useT();
  return (
    <Button
      onClick={onClick}
      disabled={scanning}
      size="hero"
      className={cn("shadow-lg hover:shadow-xl", !scanning && !hasReport && "animate-breathe")}
    >
      {scanning ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <Activity
          className="w-6 h-6 transition-transform group-hover:scale-110"
          strokeWidth={2.4}
        />
      )}
      {scanning ? t("scanning") : hasReport ? t("rescan") : t("scanCta")}
    </Button>
  );
}
