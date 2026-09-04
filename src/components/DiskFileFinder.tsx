import { useEffect, useMemo, useState } from "react";
import { Clock, FileWarning, HardDrive, Loader2, Search, Trash2 } from "lucide-react";
import type { DriveFileScan, FileDeleteResult, LargeFile, VolumeInfo } from "@/lib/types";
import {
  deleteUserFiles,
  listVolumes,
  NeedsElevationError,
  scanLargeFiles,
  toError,
} from "@/lib/api";
import { useByteFmt, useT } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { cn } from "@/lib/utils";

/** Sprint 14 eşik varsayılanları — büyük: 100MB, kullanılmayan: 180 gün. */
const MIN_SIZE_MB = 100;
const UNUSED_DAYS = 180;

interface Props {
  volumes: VolumeInfo[];
}

/** Disk doluluk kategorisi — sürücü başına büyük/kullanılmayan dosya tarayıcısı + seç-sil. */
export function DiskFileFinder({ volumes }: Props) {
  const t = useT();
  // Tam health-scan yapılmadıysa (volumes boş) sürücü listesini bağımsız çek.
  const [own, setOwn] = useState<VolumeInfo[]>([]);
  useEffect(() => {
    if (volumes.length === 0) {
      listVolumes()
        .then(setOwn)
        .catch(() => setOwn([]));
    }
  }, [volumes.length]);
  const list = volumes.length > 0 ? volumes : own;

  return (
    <div className="space-y-2.5">
      <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground px-1">
        {t("fileFinderHeading")}
      </h3>
      <p className="text-xs text-muted-foreground px-1 -mt-1">
        {t("fileFinderIntro", { size: `${MIN_SIZE_MB} MB`, days: UNUSED_DAYS })}
      </p>
      {list.map((v) => (
        <DrivePanel key={v.mountPoint} volume={v} />
      ))}
    </div>
  );
}

type Tab = "large" | "unused";

function DrivePanel({ volume }: { volume: VolumeInfo }) {
  const t = useT();
  const fmtBytes = useByteFmt();
  const drive = volume.mountPoint.replace(/\\$/, "");

  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [scan, setScan] = useState<DriveFileScan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("large");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<FileDeleteResult | null>(null);

  const files: LargeFile[] = useMemo(() => {
    if (!scan) return [];
    return tab === "large" ? scan.largeFiles : scan.unusedFiles;
  }, [scan, tab]);

  const selectedFiles = useMemo(
    () =>
      [...(scan?.largeFiles ?? []), ...(scan?.unusedFiles ?? [])].filter((f) =>
        selected.has(f.path)
      ),
    [scan, selected]
  );
  // path → boyut (aynı dosya iki listede olabilir; tekilleştir).
  const selectedTotalBytes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const f of selectedFiles) seen.set(f.path, f.sizeBytes);
    return [...seen.values()].reduce((a, b) => a + b, 0);
  }, [selectedFiles]);
  const selectedCount = new Set(selectedFiles.map((f) => f.path)).size;

  const runScan = async () => {
    setStatus("scanning");
    setErrorMsg(null);
    setDeleteResult(null);
    setSelected(new Set());
    try {
      const r = await scanLargeFiles(drive, MIN_SIZE_MB, UNUSED_DAYS);
      setScan(r);
      setTab(r.largeFiles.length === 0 && r.unusedFiles.length > 0 ? "unused" : "large");
      setStatus(r.error ? "error" : "done");
      if (r.error) setErrorMsg(r.error);
    } catch (e) {
      setStatus("error");
      setErrorMsg(toError(e).message);
    }
  };

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAllInTab = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = files.every((f) => next.has(f.path));
      for (const f of files) {
        if (allSelected) next.delete(f.path);
        else next.add(f.path);
      }
      return next;
    });
  };

  const doDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const paths = [...new Set(selectedFiles.map((f) => f.path))];
      const result = await deleteUserFiles(paths);
      setDeleteResult(result);
      // Silinen dosyaları listelerden çıkar (hata olanlar kalır).
      const failedPaths = new Set(result.errors.map((e) => e.path));
      setScan((prev) =>
        prev
          ? {
              ...prev,
              largeFiles: prev.largeFiles.filter(
                (f) => !selected.has(f.path) || failedPaths.has(f.path)
              ),
              unusedFiles: prev.unusedFiles.filter(
                (f) => !selected.has(f.path) || failedPaths.has(f.path)
              ),
            }
          : prev
      );
      setSelected(new Set());
    } catch (e) {
      if (e instanceof NeedsElevationError) {
        setErrorMsg(t("elevationRequired"));
      } else {
        setErrorMsg(toError(e).message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const usedPct = Math.min(100, Math.max(0, volume.usedPercent));
  const tone = usedPct >= 90 ? "destructive" : usedPct >= 85 ? "warning" : "primary";

  return (
    <Card variant="default" className="overflow-hidden">
      {/* sürücü başlığı + tara butonu */}
      <div className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
            tone === "destructive"
              ? "bg-destructive-soft text-destructive-strong"
              : tone === "warning"
                ? "bg-warning-soft text-warning-strong"
                : "bg-primary-soft text-primary-strong"
          )}
        >
          <HardDrive className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-semibold text-foreground">{drive}</span>
            {volume.label && (
              <span className="text-xs text-muted-foreground truncate">({volume.label})</span>
            )}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {fmtBytes(volume.usedBytes)} / {fmtBytes(volume.totalBytes)} · %{usedPct.toFixed(0)}
          </div>
        </div>
        <Button
          size="sm"
          variant={status === "done" ? "outline" : "default"}
          onClick={runScan}
          disabled={status === "scanning"}
        >
          {status === "scanning" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {status === "done" ? t("rescan") : t("fileFinderScanCta")}
        </Button>
      </div>

      {/* tarama sırasında */}
      {status === "scanning" && (
        <div className="px-4 pb-4 text-xs text-muted-foreground font-mono animate-pulse">
          {t("fileFinderScanning", { drive })}
        </div>
      )}

      {/* hata */}
      {status === "error" && errorMsg && (
        <div className="mx-4 mb-4 rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {errorMsg}
        </div>
      )}

      {/* silme özeti */}
      {deleteResult && (
        <div className="mx-4 mb-3 rounded-md bg-success-soft/60 text-success-strong text-xs p-3">
          {t("fileFinderDeleted", {
            count: deleteResult.deleted,
            size: fmtBytes(deleteResult.reclaimedBytes),
          })}
          {deleteResult.failed > 0 &&
            ` · ${t("fileFinderDeleteFailed", { count: deleteResult.failed })}`}
        </div>
      )}

      {/* sonuç */}
      {status === "done" && scan && (
        <div className="border-t border-border">
          {/* sekmeler */}
          <div className="flex items-center gap-1 px-3 pt-3">
            <TabButton
              active={tab === "large"}
              onClick={() => setTab("large")}
              icon={<FileWarning className="w-3.5 h-3.5" />}
              label={t("fileFinderTabLarge", { count: scan.largeFiles.length })}
            />
            <TabButton
              active={tab === "unused"}
              onClick={() => setTab("unused")}
              icon={<Clock className="w-3.5 h-3.5" />}
              label={t("fileFinderTabUnused", { count: scan.unusedFiles.length })}
            />
          </div>

          {files.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("fileFinderEmpty")}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2">
                <button
                  type="button"
                  onClick={selectAllInTab}
                  className="text-[11px] font-mono text-primary hover:text-primary-strong"
                >
                  {files.every((f) => selected.has(f.path))
                    ? t("fileFinderClearSel")
                    : t("fileFinderSelectAll")}
                </button>
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {t("fileFinderScannedCount", { count: scan.scannedFiles })}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto px-2 pb-2 space-y-1">
                {files.map((f) => (
                  <FileRow
                    key={f.path}
                    file={f}
                    checked={selected.has(f.path)}
                    onToggle={() => toggle(f.path)}
                    fmtBytes={fmtBytes}
                  />
                ))}
              </div>
            </>
          )}

          {/* silme aksiyon çubuğu */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3 sticky bottom-0">
              <span className="text-xs text-foreground/90 tabular-nums">
                {t("fileFinderSelectedSummary", {
                  count: selectedCount,
                  size: fmtBytes(selectedTotalBytes),
                })}
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t("fileFinderDeleteCta")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Geri Dönüşüm Kutusu'na taşıma onayı */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <div className="w-11 h-11 rounded-md bg-destructive-soft text-destructive-strong flex items-center justify-center shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <DialogTitle>{t("fileFinderConfirmTitle")}</DialogTitle>
              <DialogDescription className="mt-1">
                {t("fileFinderConfirmIntro", {
                  count: selectedCount,
                  size: fmtBytes(selectedTotalBytes),
                })}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md bg-destructive-soft/40 border border-destructive/30 p-3 text-sm text-destructive-strong">
              {t("fileFinderConfirmWarn")}
            </div>
            <ul className="mt-3 max-h-40 overflow-y-auto text-xs font-mono text-muted-foreground space-y-1">
              {[...new Set(selectedFiles.map((f) => f.path))].slice(0, 12).map((p) => (
                <li key={p} className="truncate">
                  {p}
                </li>
              ))}
              {selectedCount > 12 && <li>… +{selectedCount - 12}</li>}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              <Trash2 className="w-4 h-4" />
              {t("fileFinderConfirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-strong"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FileRow({
  file,
  checked,
  onToggle,
  fmtBytes,
}: {
  file: LargeFile;
  checked: boolean;
  onToggle: () => void;
  fmtBytes: (b: number) => string;
}) {
  const t = useT();
  const idle = file.lastAccessedDays ?? file.lastModifiedDays;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors",
        checked ? "bg-primary-soft/50" : "hover:bg-secondary/60"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
          checked
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border bg-background"
        )}
      >
        {checked && (
          <svg
            viewBox="0 0 12 12"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground truncate" title={file.path}>
          {file.name}
        </span>
        <span className="block text-[11px] font-mono text-muted-foreground truncate">
          {file.directory}
          {idle != null && ` · ${t("fileFinderIdleDays", { days: idle })}`}
        </span>
      </span>
      <span className="shrink-0 text-xs font-mono font-semibold text-foreground/90 tabular-nums">
        {fmtBytes(file.sizeBytes)}
      </span>
    </button>
  );
}
