import { FileSearch, HardDrive, Loader2, RotateCw, Wrench } from "lucide-react";
import { listIntegrityVolumes } from "@/lib/api";
import { useByteFmt, useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

interface Props {
  /** Salt-okunur bütünlük taraması (chkdsk /scan) — güvenli, reboot gerektirmez. */
  onScan: (volume: string) => void;
  /** /f onarımı — sistem sürücüsünde reboot ile autochk planlanır. */
  onRepair: (volume: string, isSystem: boolean) => void;
}

/** Disk bütünlüğü kategorisi — sabit NTFS sürücüler için proaktif chkdsk tarama/onarım paneli. */
export function DiskIntegrityPanel({ onScan, onRepair }: Props) {
  const t = useT();
  const fmtBytes = useByteFmt();
  const { data: vols, loading, error, reload: load } = useAsync(listIntegrityVolumes);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("integrityHeading")}
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:text-primary-strong disabled:opacity-50"
        >
          <RotateCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {t("rescan")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground px-1 -mt-1">{t("integrityIntro")}</p>

      {loading && !vols && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("integrityLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {error}
        </div>
      )}

      {vols && vols.length === 0 && !loading && (
        <p className="px-1 py-4 text-sm text-muted-foreground">{t("integrityNone")}</p>
      )}

      {vols?.map((v, i) => {
        const usedPct =
          v.sizeBytes > 0 ? ((v.sizeBytes - v.freeBytes) / v.sizeBytes) * 100 : 0;
        return (
          <Card key={v.driveLetter} variant="default" className="overflow-hidden animate-rise-in" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-3 p-4">
              <span className="shrink-0 w-9 h-9 rounded-md bg-primary-soft text-primary-strong flex items-center justify-center">
                <HardDrive className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-semibold text-foreground">{v.driveLetter}:</span>
                  <span className="text-xs text-muted-foreground">{v.fileSystem}</span>
                  {v.isSystem && (
                    <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-soft text-info-strong">
                      {t("integritySystemBadge")}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {fmtBytes(v.sizeBytes - v.freeBytes)} / {fmtBytes(v.sizeBytes)} · %{usedPct.toFixed(0)}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onScan(v.driveLetter)}>
                  <FileSearch className="w-4 h-4" />
                  {t("integrityScanCta")}
                </Button>
                <Button size="sm" variant="warning" onClick={() => onRepair(v.driveLetter, v.isSystem)}>
                  <Wrench className="w-4 h-4" />
                  {t("integrityRepairCta")}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
        {t("integrityFootnote")}
      </p>
    </div>
  );
}
