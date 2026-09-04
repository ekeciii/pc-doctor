import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Header } from "./components/Header";
import { HudBackdrop } from "./components/HudBackdrop";
import { ScoreHero } from "./components/ScoreHero";
import { UpdateBanner } from "./components/UpdateBanner";
import { checkForUpdate, installUpdate, type AvailableUpdate } from "./lib/updater";
import { CategoryDetail } from "./components/CategoryDetail";
import { CleanupDetail } from "./components/CleanupDetail";
import type { CategoryDef } from "./components/categoryDefs";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ElevationBanner } from "./components/ElevationBanner";
import { SfcDismProgressDialog } from "./components/SfcDismProgressDialog";
import { DefenderScanDialog } from "./components/DefenderScanDialog";
import { ChkdskProgressDialog } from "./components/ChkdskProgressDialog";
import { ChkdskFixConfirmDialog } from "./components/ChkdskFixConfirmDialog";
import { ChkdskRebootCountdownDialog } from "./components/ChkdskRebootCountdownDialog";
import { ChkdskFixResultDialog } from "./components/ChkdskFixResultDialog";
import { ChkdskPendingBanner } from "./components/ChkdskPendingBanner";
import { ChkdskBootResultBanner } from "./components/ChkdskBootResultBanner";
import { CategoryGrid } from "./components/CategoryGrid";
import { GuidedFixDrawer } from "./components/GuidedFixDrawer";
import { FixAllConfirmDialog } from "./components/FixAllConfirmDialog";
import { FixAllProgressDialog } from "./components/FixAllProgressDialog";
import { FixAllSummaryDialog } from "./components/FixAllSummaryDialog";
import { SettingsDialog, applyTheme } from "./components/SettingsDialog";
import { HistoryDialog } from "./components/HistoryDialog";
import { AiChatDrawer } from "./components/AiChatDrawer";
import { FirstRunDisclosure } from "./components/FirstRunDisclosure";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/Alert";
import { Button } from "./components/ui/Button";
import {
  executeCleanup,
  isElevated,
  NeedsElevationError,
  openOemLink,
  openSystemPropertiesPerformance,
  recordScan,
  RestoreFailedError,
  runChkdskFix,
  runFixAll,
  scan,
  VolumeLockedError,
} from "./lib/api";
import { CURRENT_DISCLOSURE_VERSION, getSettings, saveSettings, type AppSettings } from "./lib/settings";
import type {
  ChkdskFixResult,
  CleanupResult,
  FixAllOutcome,
  FixSpec,
  Finding,
  ScanReport,
} from "./lib/types";
import { resolveFinding, useByteFmt, useI18n, useT } from "./lib/i18n";

export default function App() {
  const t = useT();
  const { locale } = useI18n();
  const fmtBytes = useByteFmt();
  const [report, setReport] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [pendingCleanupIds, setPendingCleanupIds] = useState<string[] | null>(null);
  const [pendingSfc, setPendingSfc] = useState<Finding | null>(null);
  const [sfcOpen, setSfcOpen] = useState(false);
  const [pendingDefender, setPendingDefender] = useState<Finding | null>(null);
  const [defenderOpen, setDefenderOpen] = useState(false);
  const [pendingChkdsk, setPendingChkdsk] = useState<{ finding: Finding; volume: string } | null>(
    null
  );
  const [chkdskVolume, setChkdskVolume] = useState<string | null>(null);
  // Sprint 8 — chkdsk /f state machine
  const [pendingChkdskFix, setPendingChkdskFix] = useState<{
    volume: string;
    isSystem: boolean;
  } | null>(null);
  const [chkdskRebootVolume, setChkdskRebootVolume] = useState<string | null>(null);
  // Canlı (sistem-dışı) chkdsk /f sonucu — tamamlanınca kullanıcıya gösterilir.
  const [chkdskFixLiveResult, setChkdskFixLiveResult] = useState<ChkdskFixResult | null>(null);
  // Sprint 9 review H5: chkdsk /f Restore Point fail recovery banner
  const [restoreErrorChkdsk, setRestoreErrorChkdsk] = useState<{
    volume: string;
    isSystem: boolean;
    message: string;
  } | null>(null);
  // Sprint 10 review H1+H4 + Sprint 12 review H4: ScheduleInconsistentError persistent banner.
  // sessionStorage hydrate — webview reload sonrası kayıp olmaz.
  const [chkdskScheduleError, setChkdskScheduleError] = useState<{
    volume: string;
    message: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem("chkdsk-schedule-error");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chkdskScheduleError) {
      window.sessionStorage.setItem(
        "chkdsk-schedule-error",
        JSON.stringify(chkdskScheduleError)
      );
    } else {
      window.sessionStorage.removeItem("chkdsk-schedule-error");
    }
  }, [chkdskScheduleError]);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [elevated, setElevated] = useState<boolean | null>(null);
  const [forceElevationBanner, setForceElevationBanner] = useState<string | null>(null);
  const [restoreErrorIds, setRestoreErrorIds] = useState<string[] | null>(null);
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<
    { downloaded: number; total: number | null } | null
  >(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  // Faz 2 — ilk açılış veri-okuma bildirimi. Ayarların tamamını tutuyoruz ki onay
  // sadece disclosureAckVersion alanını değiştirip geri yazsın (diğer alanlara dokunmaz).
  const [settingsSnapshot, setSettingsSnapshot] = useState<AppSettings | null>(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  // Faz 1 M4 — Guided (Rehberli) bulgu için açık drawer.
  const [guidedFinding, setGuidedFinding] = useState<Finding | null>(null);
  // Yandan-kayan detay: seçili kategori (null = ana ekran).
  const [selectedCat, setSelectedCat] = useState<CategoryDef | null>(null);
  // Faz 1 M5 + Faz 2 — "Hepsini Düzelt" / tek-fix (run_fix_all) akışı.
  // pendingFixSpecs: onay bekleyen fix listesi (null = kapalı).
  const [pendingFixSpecs, setPendingFixSpecs] = useState<FixSpec[] | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [fixAllOutcome, setFixAllOutcome] = useState<FixAllOutcome | null>(null);
  const [fixAllRestoreError, setFixAllRestoreError] = useState<{
    specs: FixSpec[];
    message: string;
  } | null>(null);
  const updateChecked = useRef(false);

  useEffect(() => {
    isElevated().then(setElevated);
    // Hydrate theme + history flag from persisted settings.
    getSettings()
      .then((s) => {
        applyTheme(s.theme);
        setHistoryEnabled(s.historyEnabled);
        setSettingsSnapshot(s);
        setDisclosureOpen(s.disclosureAckVersion < CURRENT_DISCLOSURE_VERSION);
      })
      .catch(() => {
        applyTheme("auto");
      });
    if (updateChecked.current) return;
    updateChecked.current = true;
    checkForUpdate()
      .then((u) => {
        if (u) setAvailableUpdate(u);
      })
      .catch((e) => {
        console.warn("[updater] check failed:", e);
      });
  }, []);

  const handleInstallUpdate = async () => {
    if (!availableUpdate) return;
    setUpdateInstalling(true);
    setUpdateProgress({ downloaded: 0, total: null });
    setUpdateError(null);
    try {
      await installUpdate(availableUpdate, (downloaded, total) => {
        setUpdateProgress({ downloaded, total });
      });
      setAvailableUpdate(null);
    } catch (e) {
      setUpdateError(`${t("updateInstallFailed")}: ${String(e)}`);
    } finally {
      setUpdateInstalling(false);
    }
  };

  // Ham hata metnini kullanıcıya doğrudan göstermek yerine dostça bir mesaj +
  // (isteğe bağlı) açılır teknik detay olarak sunar. Teknik olmayan kullanıcı
  // anlamsız Rust/IPC string'i yerine ne yapacağını anlar.
  const showError = useCallback(
    (e: unknown, friendly?: string) => {
      const raw = e instanceof Error ? e.message : String(e);
      const message = friendly ?? t("errorGeneric");
      setError({ message, detail: raw && raw !== message ? raw : undefined });
    },
    [t]
  );

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setLastResult(null);
    setSelectedCat(null);
    setForceElevationBanner(null);
    setRestoreErrorIds(null);
    setRestoreErrorMessage(null);
    try {
      const r = await scan();
      setReport(r);
      // Fire-and-forget history record. Hata UI'ı kirletmez.
      if (historyEnabled) {
        recordScan(r).catch((err) => console.warn("[history] record failed:", err));
      }
    } catch (e) {
      showError(e, t("scanFailed"));
    } finally {
      setScanning(false);
    }
  };

  const runCleanup = async (ids: string[], forceWithoutRestore: boolean) => {
    setCleaning(true);
    setError(null);
    setRestoreErrorIds(null);
    setRestoreErrorMessage(null);
    try {
      const result = await executeCleanup(ids, forceWithoutRestore);
      setLastResult(result);
      setPendingCleanupIds(null);
      const fresh = await scan();
      setReport(fresh);
      if (historyEnabled) {
        recordScan(fresh).catch((err) => console.warn("[history] record failed:", err));
      }
    } catch (e) {
      if (e instanceof NeedsElevationError) {
        setForceElevationBanner(e.message);
      } else if (e instanceof RestoreFailedError) {
        setRestoreErrorIds(ids);
        setRestoreErrorMessage(e.message);
      } else {
        showError(e, t("cleanupFailed"));
      }
      setPendingCleanupIds(null);
    } finally {
      setCleaning(false);
    }
  };

  const confirmFix = () => {
    if (!pendingCleanupIds) return;
    void runCleanup(pendingCleanupIds, false);
  };

  const retryWithoutRestore = () => {
    if (!restoreErrorIds) return;
    void runCleanup(restoreErrorIds, true);
  };

  const openSystemProtection = async () => {
    try {
      await openOemLink("ms-settings:about");
    } catch {
      /* sessizce yut */
    }
  };

  const confirmCleanupBodyLines = useMemo(() => {
    if (!report || !pendingCleanupIds) return [];
    return report.cleanupTargets
      .filter((target) => pendingCleanupIds.includes(target.id))
      .map((target) => `${target.label} (${fmtBytes(target.sizeBytes)})`);
  }, [report, pendingCleanupIds, fmtBytes]);

  const handleOpenUrl = async (url: string) => {
    try {
      await openOemLink(url);
    } catch (e) {
      showError(e, t("openOemFailed"));
    }
  };

  // Tüm action handler'ları useCallback ile sarmala → child dialog'larda useEffect
  // dep array stable kalır, listener leak riski azalır (review M8).
  const requireElevated = useCallback(
    (reason: string): boolean => {
      if (elevated === false) {
        setForceElevationBanner(reason);
        return false;
      }
      return true;
    },
    [elevated]
  );

  // Faz 2 — bir bulgunun aksiyonunu otomatik FixSpec'e çevirir (Auto olmayan → null).
  const actionToFixSpec = useCallback((finding: Finding): FixSpec | null => {
    switch (finding.action?.type) {
      case "enableFirewall":
        return { type: "enableFirewall" };
      case "enableUac":
        return { type: "enableUac" };
      case "setPagefileManaged":
        return { type: "setPagefileManaged" };
      case "runDefenderQuickScan":
        return { type: "runDefenderQuickScan" };
      case "runSystemFileCheck":
        return { type: "runSystemFileCheck" };
      default:
        return null;
    }
  }, []);

  // "Hepsini Düzelt": tüm güvenli otomatik fix'ler (disk temizliği + sistem fix'leri),
  // tek restore point + tek elevation + per-item özet (run_fix_all).
  const handleFixAll = useCallback(() => {
    if (!report) return;
    if (!requireElevated(t("elevationRequired"))) return;
    const specs: FixSpec[] = [];
    if (report.cleanupTargets.length > 0) {
      specs.push({ type: "cleanup", targetIds: report.cleanupTargets.map((x) => x.id) });
    }
    const seen = new Set<string>();
    for (const f of report.findings) {
      const s = actionToFixSpec(f);
      if (s && !seen.has(s.type)) {
        seen.add(s.type);
        specs.push(s);
      }
    }
    if (specs.length === 0) return;
    setPendingFixSpecs(specs);
  }, [report, requireElevated, t, actionToFixSpec]);

  // Disk doluluk bulgusunda "Yer aç": tüm temizlik hedeflerini onaya sun → runCleanup
  // (restore point + rescan + lastResult). Çözüm bandı CategoryDetail'de gösterilir.
  const handleCleanupDisk = useCallback(() => {
    if (!report || report.cleanupTargets.length === 0) return;
    if (!requireElevated(t("elevationRequired"))) return;
    setPendingCleanupIds(report.cleanupTargets.map((x) => x.id));
  }, [report, requireElevated, t]);

  // Tek bulguda "Düzelt": yalnız o fix.
  const handleApplyFix = useCallback(
    (finding: Finding) => {
      if (!requireElevated(t("elevationRequired"))) return;
      const s = actionToFixSpec(finding);
      if (s) setPendingFixSpecs([s]);
    },
    [requireElevated, t, actionToFixSpec]
  );

  const doFixAll = useCallback(
    async (specs: FixSpec[], force: boolean) => {
      if (specs.length === 0) return;
      setFixingAll(true);
      setFixAllRestoreError(null);
      try {
        const outcome = await runFixAll(specs, force);
        setPendingFixSpecs(null);
        setFixAllOutcome(outcome);
        // Skoru gerçekten tazele (sahte değil).
        const fresh = await scan();
        setReport(fresh);
        if (historyEnabled) {
          recordScan(fresh).catch((err) => console.warn("[history] record failed:", err));
        }
      } catch (e) {
        setPendingFixSpecs(null);
        if (e instanceof NeedsElevationError) {
          setForceElevationBanner(e.message);
        } else if (e instanceof RestoreFailedError) {
          setFixAllRestoreError({ specs, message: e.message });
        } else {
          showError(e);
        }
      } finally {
        setFixingAll(false);
      }
    },
    [historyEnabled]
  );

  // Onay modalı için fix listesi etiketleri.
  const fixSpecLines = useMemo(() => {
    if (!pendingFixSpecs) return [];
    return pendingFixSpecs.map((s) => {
      switch (s.type) {
        case "cleanup":
          return t("fixLineCleanup", {
            count: report?.cleanupTargets.length ?? s.targetIds.length,
            size: fmtBytes(report?.totalReclaimableBytes ?? 0),
          });
        case "enableFirewall":
          return t("fixLineEnableFirewall");
        case "enableUac":
          return t("fixLineEnableUac");
        case "setPagefileManaged":
          return t("fixLineSetPagefileManaged");
        case "runDefenderQuickScan":
          return t("fixLineDefenderScan");
        case "runSystemFileCheck":
          return t("fixLineSystemFileCheck");
      }
    });
  }, [pendingFixSpecs, report, t, fmtBytes]);

  // Seçili kategorinin bulguları (detay paneli için).
  const findingsForSelectedCat = useMemo(() => {
    if (!report || !selectedCat || selectedCat.key === "cleanup") return [];
    return report.findings.filter((f) => selectedCat.matches.includes(f.category));
  }, [report, selectedCat]);

  const handleSystemFileCheck = useCallback((finding: Finding) => setPendingSfc(finding), []);
  const confirmSfc = useCallback(() => {
    setPendingSfc(null);
    if (!requireElevated(t("elevationRequired"))) return;
    setSfcOpen(true);
  }, [requireElevated, t]);

  const handleDefenderQuickScan = useCallback(
    (finding: Finding) => setPendingDefender(finding),
    []
  );
  const confirmDefender = useCallback(() => {
    setPendingDefender(null);
    if (!requireElevated(t("elevationRequired"))) return;
    setDefenderOpen(true);
  }, [requireElevated, t]);

  const handleChkdskScan = useCallback(
    (finding: Finding, volume: string) => setPendingChkdsk({ finding, volume }),
    []
  );

  // Sprint 8 — chkdsk /f action handler
  const handleChkdskFix = useCallback(
    (_finding: Finding, volume: string, isSystem: boolean) => {
      setPendingChkdskFix({ volume, isSystem });
    },
    []
  );

  const handleChkdskFixConfirm = useCallback(
    async (force: boolean) => {
      if (!pendingChkdskFix) return;
      const { volume, isSystem } = pendingChkdskFix;
      setPendingChkdskFix(null);
      if (!requireElevated(t("elevationRequired"))) return;
      try {
        const result = await runChkdskFix(volume, force);
        if (result.mode === "scheduled") {
          // System drive — open reboot countdown
          setChkdskRebootVolume(volume);
        } else {
          // Sistem-dışı (canlı) sonuç: kullanıcıya sonucu göster + raporu tazele.
          setChkdskFixLiveResult(result);
          try {
            const fresh = await scan();
            setReport(fresh);
            if (historyEnabled) {
              recordScan(fresh).catch((err) =>
                console.warn("[history] record failed:", err)
              );
            }
          } catch (err) {
            console.warn("[chkdsk] rescan after live fix failed:", err);
          }
        }
      } catch (e) {
        if (e instanceof NeedsElevationError) {
          setForceElevationBanner(e.message);
        } else if (e instanceof RestoreFailedError) {
          // Sprint 9 review H5 fix: cleanup flow ile aynı recovery banner pattern'i.
          // Kullanıcı "Yine de devam et" (force=true) ile retry edebilir.
          setRestoreErrorChkdsk({ volume, isSystem, message: e.message });
        } else if (e instanceof VolumeLockedError) {
          // VolumeLocked mesajı backend'den anlamlı gelir — doğrudan göster.
          setError({ message: e.message });
        } else {
          showError(e, t("chkdskFixLiveFailed"));
        }
      }
    },
    [pendingChkdskFix, requireElevated, t, historyEnabled, showError]
  );

  // Sprint 9 review H5 — chkdsk /f RestoreFailed retry handler
  const retryChkdskFixWithoutRestore = useCallback(async () => {
    if (!restoreErrorChkdsk) return;
    const { volume, isSystem } = restoreErrorChkdsk;
    setRestoreErrorChkdsk(null);
    setPendingChkdskFix({ volume, isSystem });
    // Kullanıcı tekrar onaylar ve ConfirmDialog force checkbox ile devam eder
  }, [restoreErrorChkdsk]);
  const confirmChkdsk = useCallback(() => {
    if (!pendingChkdsk) return;
    const vol = pendingChkdsk.volume;
    setPendingChkdsk(null);
    if (!requireElevated(t("elevationRequired"))) return;
    setChkdskVolume(vol);
  }, [pendingChkdsk, requireElevated, t]);

  const handleOpenSystemPropertiesPerformance = useCallback(async () => {
    try {
      await openSystemPropertiesPerformance();
    } catch (e) {
      showError(e);
    }
  }, [showError]);

  // M4 — GuidedFixDrawer "Ayarı aç": bulgunun action'ına göre doğru hedefi açar.
  const handleGuidedOpenTarget = useCallback(
    async (finding: Finding) => {
      const a = finding.action;
      if (a?.type === "openUrl") {
        await handleOpenUrl(a.url);
      } else if (a?.type === "openSystemPropertiesPerformance") {
        await handleOpenSystemPropertiesPerformance();
      }
      setGuidedFinding(null);
    },
    [handleOpenSystemPropertiesPerformance]
  );

  const handleChkdskClose = useCallback(() => setChkdskVolume(null), []);
  const handleChkdskNeedsElevation = useCallback(
    (reason: string) => setForceElevationBanner(reason),
    []
  );

  // Code-only Finding'lerde title boş; ConfirmDialog için locale-aware başlık.
  const resolvedPendingChkdsk = useMemo(
    () => (pendingChkdsk ? resolveFinding(pendingChkdsk.finding, locale) : null),
    [pendingChkdsk, locale]
  );
  const resolvedPendingSfc = useMemo(
    () => (pendingSfc ? resolveFinding(pendingSfc, locale) : null),
    [pendingSfc, locale]
  );
  const resolvedPendingDefender = useMemo(
    () => (pendingDefender ? resolveFinding(pendingDefender, locale) : null),
    [pendingDefender, locale]
  );

  // Faz 2 — ilk açılış bildirimi kapatıldığında (buton veya Escape/backdrop) onayı
  // kaydet. Ayarlar hiç okunamadıysa (offline/hata) modalı yine de kapat — sadece
  // bir sonraki açılışta tekrar görünür, engelleyici bir akış değil.
  const handleDisclosureAck = async () => {
    setDisclosureOpen(false);
    if (!settingsSnapshot) return;
    try {
      const next = { ...settingsSnapshot, disclosureAckVersion: CURRENT_DISCLOSURE_VERSION };
      const saved = await saveSettings(next);
      setSettingsSnapshot(saved);
    } catch (e) {
      console.warn("[disclosure] ack save failed:", e);
    }
  };

  const handleSettingsClose = async () => {
    setSettingsOpen(false);
    // Re-read settings (history flag may have changed) — snapshot da tazelenir ki
    // handleDisclosureAck ileride eski değerlerin üstüne yazmasın.
    try {
      const s = await getSettings();
      setHistoryEnabled(s.historyEnabled);
      setSettingsSnapshot(s);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <HudBackdrop band={report?.health.band} />
      <div className="relative z-10 flex flex-col h-full w-full px-6 py-5 max-w-5xl mx-auto min-h-0">
        <Header
          elevated={elevated}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenChat={() => setChatOpen(true)}
        />

        {availableUpdate && !updateDismissed && (
          <>
            <UpdateBanner
              update={availableUpdate}
              installing={updateInstalling}
              progress={updateProgress}
              onInstall={handleInstallUpdate}
              onDismiss={() => {
                setUpdateDismissed(true);
                setUpdateError(null);
              }}
            />
            {updateError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{updateError}</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {elevated !== null && (
          <ElevationBanner
            isElevated={elevated}
            forceShow={!!forceElevationBanner}
            reason={forceElevationBanner || undefined}
          />
        )}

        {/* Sprint 8: pending chkdsk schedule + autochk reboot result banners */}
        <ChkdskPendingBanner
          onRequestReboot={(v) => setChkdskRebootVolume(v)}
          onScheduleInconsistent={(volume, message) => {
            console.error("[chkdsk] schedule inconsistent", volume, message);
            setChkdskScheduleError({ volume, message });
          }}
        />
        <ChkdskBootResultBanner />

        {/* Sprint 10 review H1+H4: persistent destructive Alert — chkntfs /x fail */}
        {chkdskScheduleError && (
          <Alert variant="destructive" className="mb-4 items-start animate-fade-in">
            <ShieldAlert />
            <div className="flex-1 min-w-0">
              <AlertTitle>
                {t("chkdskScheduleInconsistentTitle", {
                  volume: chkdskScheduleError.volume,
                })}
              </AlertTitle>
              <AlertDescription className="mt-1">
                {t("chkdskScheduleInconsistentBody", {
                  volume: chkdskScheduleError.volume,
                })}
              </AlertDescription>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {t("technicalDetail")}
                </summary>
                <pre className="mt-2 p-2 rounded bg-muted/40 font-mono text-[11px] whitespace-pre-wrap break-words">
                  {chkdskScheduleError.message}
                </pre>
              </details>
            </div>
            <div className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChkdskScheduleError(null)}
              >
                {t("chkdskScheduleInconsistentDismiss")}
              </Button>
            </div>
          </Alert>
        )}

        {restoreErrorIds && (
          <Alert variant="warning" className="mb-5 items-start animate-fade-in">
            <ShieldAlert />
            <div className="flex-1 min-w-0">
              <AlertTitle>{t("restoreErrorTitle")}</AlertTitle>
              <AlertDescription className="mt-1">
                {t("restoreErrorExplain")}
              </AlertDescription>
              {restoreErrorMessage && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {t("technicalDetail")}
                  </summary>
                  <pre className="mt-2 p-2 rounded bg-muted/40 font-mono text-[11px] whitespace-pre-wrap break-words">
                    {restoreErrorMessage}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button variant="warning" size="default" onClick={retryWithoutRestore}>
                {t("proceedWithoutRestore")}
              </Button>
              <Button variant="outline" size="sm" onClick={openSystemProtection}>
                {t("openSystemProtection")}
              </Button>
            </div>
          </Alert>
        )}

        {/* Sprint 9 review H5: chkdsk /f Restore Point fail recovery banner */}
        {restoreErrorChkdsk && (
          <Alert variant="warning" className="mb-5 items-start animate-fade-in">
            <ShieldAlert />
            <div className="flex-1 min-w-0">
              <AlertTitle>{t("restoreErrorTitle")}</AlertTitle>
              <AlertDescription className="mt-1">
                {t("restoreErrorExplain")}
              </AlertDescription>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {t("technicalDetail")}
                </summary>
                <pre className="mt-2 p-2 rounded bg-muted/40 font-mono text-[11px] whitespace-pre-wrap break-words">
                  {restoreErrorChkdsk.message}
                </pre>
              </details>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                variant="warning"
                size="default"
                onClick={retryChkdskFixWithoutRestore}
              >
                {t("proceedWithoutRestore")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreErrorChkdsk(null)}
              >
                {t("cancel")}
              </Button>
            </div>
          </Alert>
        )}

        {/* Faz 1 M5: "Hepsini Düzelt" Restore Point fail recovery */}
        {fixAllRestoreError && (
          <Alert variant="warning" className="mb-5 items-start animate-fade-in">
            <ShieldAlert />
            <div className="flex-1 min-w-0">
              <AlertTitle>{t("restoreErrorTitle")}</AlertTitle>
              <AlertDescription className="mt-1">{t("restoreErrorExplain")}</AlertDescription>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {t("technicalDetail")}
                </summary>
                <pre className="mt-2 p-2 rounded bg-muted/40 font-mono text-[11px] whitespace-pre-wrap break-words">
                  {fixAllRestoreError.message}
                </pre>
              </details>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                variant="warning"
                size="default"
                onClick={() => {
                  const specs = fixAllRestoreError.specs;
                  setFixAllRestoreError(null);
                  void doFixAll(specs, true);
                }}
              >
                {t("proceedWithoutRestore")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFixAllRestoreError(null)}>
                {t("cancel")}
              </Button>
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <AlertDescription>{error.message}</AlertDescription>
                {error.detail && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-destructive-strong/80 hover:text-destructive-strong">
                      {t("errorShowDetails")}
                    </summary>
                    <pre className="mt-1.5 whitespace-pre-wrap break-words text-[11px] font-mono opacity-80">
                      {error.detail}
                    </pre>
                  </details>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setError(null)}
              >
                {t("errorDismiss")}
              </Button>
            </div>
          </Alert>
        )}

        {/* Tek ekran, yandan-kayan navigasyon: ANA panel ↔ kategori DETAY */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{
              width: "200%",
              transform: selectedCat ? "translateX(-50%)" : "translateX(0)",
            }}
          >
            {/* ANA panel */}
            <div className="w-1/2 h-full overflow-y-auto px-1 pb-4">
              <ScoreHero
                report={report}
                scanning={scanning}
                fixing={fixingAll}
                onScan={runScan}
                onFixAll={handleFixAll}
              />
              <CategoryGrid report={report} onSelect={setSelectedCat} />
            </div>

            {/* DETAY panel (yandan kayar) */}
            <div className="w-1/2 h-full px-1 pt-2" aria-hidden={!selectedCat}>
              {selectedCat?.key === "cleanup" ? (
                <CleanupDetail
                  targets={report?.cleanupTargets ?? []}
                  totalBytes={report?.totalReclaimableBytes ?? 0}
                  busy={cleaning}
                  lastResult={lastResult}
                  onFix={(ids) => setPendingCleanupIds(ids)}
                  onBack={() => setSelectedCat(null)}
                />
              ) : (
                <CategoryDetail
                  category={selectedCat}
                  findings={findingsForSelectedCat}
                  onBack={() => setSelectedCat(null)}
                  onSystemFileCheck={handleSystemFileCheck}
                  onDefenderQuickScan={handleDefenderQuickScan}
                  onChkdskScan={handleChkdskScan}
                  onChkdskFix={handleChkdskFix}
                  onGuided={setGuidedFinding}
                  onApplyFix={handleApplyFix}
                  onCleanupDisk={handleCleanupDisk}
                  volumes={report?.volumes}
                  reclaimableBytes={report?.totalReclaimableBytes ?? 0}
                  cleanupResult={lastResult}
                />
              )}
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={!!pendingCleanupIds}
          bodyLines={confirmCleanupBodyLines}
          onCancel={() => setPendingCleanupIds(null)}
          onConfirm={confirmFix}
        />

        <ConfirmDialog
          open={!!pendingSfc}
          bodyLines={
            pendingSfc && resolvedPendingSfc
              ? [resolvedPendingSfc.title || pendingSfc.title || "", t("sfcConfirmIntro")]
              : []
          }
          onCancel={() => setPendingSfc(null)}
          onConfirm={confirmSfc}
        />

        <ConfirmDialog
          open={!!pendingDefender}
          bodyLines={
            pendingDefender && resolvedPendingDefender
              ? [
                  resolvedPendingDefender.title || pendingDefender.title || "",
                  t("defenderConfirmIntro"),
                ]
              : []
          }
          onCancel={() => setPendingDefender(null)}
          onConfirm={confirmDefender}
        />

        <ConfirmDialog
          open={!!pendingChkdsk}
          bodyLines={
            pendingChkdsk && resolvedPendingChkdsk
              ? [
                  resolvedPendingChkdsk.title ||
                    t("chkdskRunning", { volume: pendingChkdsk.volume }),
                  t("chkdskConfirmIntro", { volume: pendingChkdsk.volume }),
                ]
              : []
          }
          onCancel={() => setPendingChkdsk(null)}
          onConfirm={confirmChkdsk}
        />

        <ChkdskProgressDialog
          open={chkdskVolume !== null}
          volume={chkdskVolume}
          onClose={handleChkdskClose}
          onNeedsElevation={handleChkdskNeedsElevation}
        />

        {/* Sprint 8: chkdsk /f confirm + reboot countdown */}
        {pendingChkdskFix && (
          <ChkdskFixConfirmDialog
            open
            volume={pendingChkdskFix.volume}
            isSystem={pendingChkdskFix.isSystem}
            onConfirm={handleChkdskFixConfirm}
            onCancel={() => setPendingChkdskFix(null)}
          />
        )}
        <ChkdskRebootCountdownDialog
          open={chkdskRebootVolume !== null}
          volume={chkdskRebootVolume ?? ""}
          onAbort={() => setChkdskRebootVolume(null)}
          onClose={() => setChkdskRebootVolume(null)}
        />

        <ChkdskFixResultDialog
          result={chkdskFixLiveResult}
          onClose={() => setChkdskFixLiveResult(null)}
        />

        <SfcDismProgressDialog
          open={sfcOpen}
          onClose={() => setSfcOpen(false)}
          onNeedsElevation={(reason) => setForceElevationBanner(reason)}
        />

        <DefenderScanDialog
          open={defenderOpen}
          onClose={() => setDefenderOpen(false)}
          onNeedsElevation={(reason) => setForceElevationBanner(reason)}
        />

        <SettingsDialog
          open={settingsOpen}
          onClose={handleSettingsClose}
          onShowHistory={() => setHistoryOpen(true)}
        />

        <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />

        <AiChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} report={report} />

        <GuidedFixDrawer
          finding={guidedFinding}
          onOpenTarget={handleGuidedOpenTarget}
          onClose={() => setGuidedFinding(null)}
        />

        <FixAllConfirmDialog
          open={pendingFixSpecs !== null}
          lines={fixSpecLines}
          busy={fixingAll}
          onConfirm={() => {
            if (pendingFixSpecs) void doFixAll(pendingFixSpecs, false);
          }}
          onCancel={() => setPendingFixSpecs(null)}
        />

        <FixAllProgressDialog open={fixingAll} />

        <FirstRunDisclosure open={disclosureOpen} onAck={handleDisclosureAck} />

        <FixAllSummaryDialog
          outcome={fixAllOutcome}
          onClose={() => setFixAllOutcome(null)}
        />
      </div>
    </div>
  );
}
