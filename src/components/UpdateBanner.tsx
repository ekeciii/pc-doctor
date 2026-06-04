import { Download, Loader2, RefreshCw, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { Button } from "./ui/Button";
import { Progress } from "./ui/Progress";
import type { AvailableUpdate } from "@/lib/updater";

interface Props {
  update: AvailableUpdate;
  installing: boolean;
  progress: { downloaded: number; total: number | null } | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ update, installing, progress, onInstall, onDismiss }: Props) {
  const percent =
    progress && progress.total
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  return (
    <Alert variant="info" className="mb-5 items-start animate-fade-in">
      <RefreshCw />
      <div className="flex-1 min-w-0">
        <AlertTitle>Yeni sürüm mevcut: v{update.version}</AlertTitle>
        <AlertDescription className="mt-1">
          {update.notes
            ? update.notes.split(/\r?\n/).slice(0, 3).join(" · ")
            : "Sürüm notları yok. Şimdi indirip kurabilirsin."}
        </AlertDescription>
        {installing && (
          <div className="mt-3 space-y-1">
            <Progress value={percent ?? 0} tone="primary" />
            <p className="text-xs text-muted-foreground">
              {percent !== null ? `İndiriliyor… %${percent}` : "İndirme başlıyor…"}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <Button
          variant="default"
          size="default"
          onClick={onInstall}
          disabled={installing}
        >
          {installing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Kuruluyor
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              İndir ve kur
            </>
          )}
        </Button>
        {!installing && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="w-3.5 h-3.5" />
            Sonra
          </Button>
        )}
      </div>
    </Alert>
  );
}
