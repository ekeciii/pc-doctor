import { History, Settings as SettingsIcon, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLockup } from "./BrandMark";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { useT } from "@/lib/i18n";

interface Props {
  elevated: boolean | null;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenChat: () => void;
}

export function Header({ elevated, onOpenSettings, onOpenHistory, onOpenChat }: Props) {
  const t = useT();
  return (
    <header className="flex items-center justify-between gap-4 pt-1">
      <BrandLockup />
      <div className="flex items-center gap-2">
        {elevated && (
          <Badge variant="success-soft" size="default" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t("adminBadge")}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenChat}
          aria-label={t("aiTitle")}
        >
          <Sparkles className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenHistory}
          aria-label={t("historyTitle")}
        >
          <History className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          aria-label={t("settingsTitle")}
        >
          <SettingsIcon className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
