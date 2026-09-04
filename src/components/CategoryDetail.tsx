import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import type { CleanupResult, Finding, VolumeInfo } from "@/lib/types";
import { useByteFmt, useT } from "@/lib/i18n";
import { FindingCard } from "./FindingCard";
import { VolumeGrid } from "./VolumeGrid";
import { DiskFileFinder } from "./DiskFileFinder";
import { DiskHealthPanel } from "./DiskHealthPanel";
import { DiskIntegrityPanel } from "./DiskIntegrityPanel";
import { EventLogPanel } from "./EventLogPanel";
import { DriversPanel } from "./DriversPanel";
import { DefenderPanel } from "./DefenderPanel";
import { ThermalPanel } from "./ThermalPanel";
import { SecurityPanel } from "./SecurityPanel";
import { UpdatesPanel } from "./UpdatesPanel";
import { StartupPanel } from "./StartupPanel";
import { CrashPanel } from "./CrashPanel";
import { PagefilePanel } from "./PagefilePanel";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { cn } from "@/lib/utils";
import type { CategoryDef } from "./categoryDefs";

interface Props {
  category: CategoryDef | null;
  findings: Finding[];
  onBack: () => void;
  onSystemFileCheck: (f: Finding) => void;
  onDefenderQuickScan: (f: Finding) => void;
  onChkdskScan: (f: Finding, volume: string) => void;
  onChkdskFix: (f: Finding, volume: string, isSystem: boolean) => void;
  onGuided: (f: Finding) => void;
  onApplyFix: (f: Finding) => void;
  onCleanupDisk: (f: Finding) => void;
  /** Disk doluluk kategorisi için sürücü kullanım çubukları. */
  volumes?: VolumeInfo[];
  /** Disk doluluk kategorisi için temizlikle geri kazanılabilir toplam bayt. */
  reclaimableBytes?: number;
  /** Son temizlik sonucu — çözüm bandı ("ne açıldı, çözüldü mü") için. */
  cleanupResult?: CleanupResult | null;
}

/** Yandan kayan kategori detay paneli — o kategorinin bulguları + düzeltmeleri. */
export function CategoryDetail({
  category,
  findings,
  onBack,
  onSystemFileCheck,
  onDefenderQuickScan,
  onChkdskScan,
  onChkdskFix,
  onGuided,
  onApplyFix,
  onCleanupDisk,
  volumes,
  reclaimableBytes = 0,
  cleanupResult,
}: Props) {
  const t = useT();
  const fmtBytes = useByteFmt();
  if (!category) return null;
  const Icon = category.icon;
  const isDiskFull = category.key === "disk-full";
  const isDiskHealth = category.key === "disk-health";
  const isChkdsk = category.key === "chkdsk";
  const isEvents = category.key === "events";
  const isDrivers = category.key === "drivers";
  const isVirus = category.key === "virus";
  const isThermal = category.key === "thermal";
  const isSecurity = category.key === "security";
  const isUpdates = category.key === "updates";
  const isStartup = category.key === "startup";
  const isCrashes = category.key === "crashes";
  const isPagefile = category.key === "pagefile";

  // Panellerden başlatılan tek-tık fix'ler için sentetik finding (action → run_fix_all).
  const synthFix = (action: Finding["action"]): Finding => ({
    id: `panel-fix:${action?.type ?? "x"}`,
    category: "",
    title: "",
    description: "",
    severity: "good",
    metric: null,
    recommendedAction: null,
    action,
  });

  // Panelden başlatılan chkdsk tarama/onarımı için minimal sentetik finding
  // (onChkdskScan/onChkdskFix bir Finding bekler; kodları boş → confirm dialog fallback başlığı kullanır).
  const synthChkdsk = (volume: string): Finding => ({
    id: `chkdsk-panel:${volume}`,
    category: "Disk bütünlüğü",
    title: "",
    description: "",
    severity: "good",
    metric: null,
    recommendedAction: null,
    action: null,
  });

  // sfc/DISM onarımı için minimal sentetik finding (Çökme paneli vb.).
  const synthSfc = (): Finding => ({
    id: "panel:sfc",
    category: "",
    title: "",
    description: "",
    severity: "good",
    metric: null,
    recommendedAction: null,
    action: null,
  });

  // Defender panelinden başlatılan Hızlı Tarama için minimal sentetik finding.
  const synthDefender = (): Finding => ({
    id: "defender-panel:quick-scan",
    category: "Virüs",
    title: "",
    description: "",
    severity: "good",
    metric: null,
    recommendedAction: null,
    action: null,
  });

  return (
    <div className="flex flex-col h-full">
      {/* başlık */}
      <div className="flex items-center gap-3 px-1 pb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className={cn(
            "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
            "border border-border bg-card/60 backdrop-blur-sm text-foreground",
            "hover:-translate-x-0.5 hover:border-primary/40 transition-[transform,border-color]"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="shrink-0 w-10 h-10 rounded-md bg-primary-soft/70 text-primary-strong flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground truncate">
            {category.label}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {t("categoryCount", { count: findings.length })}
          </p>
        </div>
      </div>

      {/* bulgular (panel içi scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
        {/* Disk doluluk: sürücü kullanım çubukları + dosya tarayıcısı + çözüm bandı */}
        {isDiskFull && (
          <div className="space-y-2.5 mb-1">
            {cleanupResult && cleanupResult.reclaimedBytes > 0 && (
              <Alert variant="success" className="items-start">
                <Sparkles />
                <div>
                  <AlertTitle>
                    {t("diskResolvedTitle", {
                      size: fmtBytes(cleanupResult.reclaimedBytes),
                    })}
                  </AlertTitle>
                  <AlertDescription className="mt-1">{t("diskResolvedBody")}</AlertDescription>
                </div>
              </Alert>
            )}
            {volumes && volumes.length > 0 && (
              <>
                <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground px-1">
                  {t("diskUsageHeading")}
                </h3>
                <VolumeGrid volumes={volumes} />
                {reclaimableBytes > 0 && !cleanupResult && (
                  <p className="text-xs text-muted-foreground font-mono px-1 pt-0.5">
                    {t("diskReclaimableHint", { size: fmtBytes(reclaimableBytes) })}
                  </p>
                )}
              </>
            )}
            <div className="pt-2">
              <DiskFileFinder volumes={volumes ?? []} />
            </div>
          </div>
        )}
        {/* Disk sağlığı: fiziksel disk SMART telemetri paneli */}
        {isDiskHealth && (
          <div className="mb-1">
            <DiskHealthPanel />
          </div>
        )}
        {/* Disk bütünlüğü: NTFS sürücüler için proaktif chkdsk tarama/onarım paneli */}
        {isChkdsk && (
          <div className="mb-1">
            <DiskIntegrityPanel
              onScan={(v) => onChkdskScan(synthChkdsk(v), v)}
              onRepair={(v, isSystem) => onChkdskFix(synthChkdsk(v), v, isSystem)}
            />
          </div>
        )}
        {/* Olay günlüğü: son N gündeki Kritik/Hata olay özet paneli (PII-güvenli) */}
        {isEvents && (
          <div className="mb-1">
            <EventLogPanel />
          </div>
        )}
        {/* Sürücüler: dikkat gerektiren sürücüler paneli (imzasız + eski) */}
        {isDrivers && (
          <div className="mb-1">
            <DriversPanel />
          </div>
        )}
        {/* Virüs/Defender: koruma durum panosu + son tehditler + hızlı tarama */}
        {isVirus && (
          <div className="mb-1">
            <DefenderPanel onQuickScan={() => onDefenderQuickScan(synthDefender())} />
          </div>
        )}
        {/* Sıcaklık: termal bölgeler + CPU performans/yük paneli */}
        {isThermal && (
          <div className="mb-1">
            <ThermalPanel />
          </div>
        )}
        {/* Güvenlik konfigi: firewall/UAC/BitLocker/DNS/hosts duruş panosu */}
        {isSecurity && (
          <div className="mb-1">
            <SecurityPanel
              onEnableFirewall={() => onApplyFix(synthFix({ type: "enableFirewall" }))}
              onEnableUac={() => onApplyFix(synthFix({ type: "enableUac" }))}
            />
          </div>
        )}
        {/* Güncellemeler: bekleyen Windows Update + winget paneli */}
        {isUpdates && (
          <div className="mb-1">
            <UpdatesPanel />
          </div>
        )}
        {/* Başlangıç: boot süresi + başlangıç öğeleri paneli */}
        {isStartup && (
          <div className="mb-1">
            <StartupPanel />
          </div>
        )}
        {/* Çökme geçmişi: WER sayısı + en çok çöken kaynaklar paneli */}
        {isCrashes && (
          <div className="mb-1">
            <CrashPanel onRepairSystemFiles={() => onSystemFileCheck(synthSfc())} />
          </div>
        )}
        {/* Sanal bellek: RAM/pagefile/hibernation paneli */}
        {isPagefile && (
          <div className="mb-1">
            <PagefilePanel
              onSetManaged={() => onApplyFix(synthFix({ type: "setPagefileManaged" }))}
            />
          </div>
        )}
        {findings.length === 0 ? (
          // Disk kategorileri kendi panelleriyle durumu zaten gösterir → genel uyarıyı atla.
          isDiskFull ||
          isDiskHealth ||
          isChkdsk ||
          isEvents ||
          isDrivers ||
          isVirus ||
          isThermal ||
          isSecurity ||
          isUpdates ||
          isStartup ||
          isCrashes ? null : (
            <Alert variant="success">
              <CheckCircle2 />
              <div>
                <AlertTitle>{t("scanHealthyTitle")}</AlertTitle>
                <AlertDescription className="mt-1">{t("scanHealthyBody")}</AlertDescription>
              </div>
            </Alert>
          )
        ) : (
          findings.map((f, i) => (
            <FindingCard
              key={f.id}
              finding={f}
              index={i}
              onSystemFileCheck={onSystemFileCheck}
              onDefenderQuickScan={onDefenderQuickScan}
              onChkdskScan={onChkdskScan}
              onChkdskFix={onChkdskFix}
              onGuided={onGuided}
              onApplyFix={onApplyFix}
              onCleanupDisk={onCleanupDisk}
            />
          ))
        )}
      </div>
    </div>
  );
}
