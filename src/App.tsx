import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Header } from "./components/Header";
import { ScoreHero } from "./components/ScoreHero";
import { UpdateBanner } from "./components/UpdateBanner";
import { checkForUpdate, installUpdate, type AvailableUpdate } from "./lib/updater";
import { FindingCard } from "./components/FindingCard";
import { CleanupPanel } from "./components/CleanupPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { VolumeGrid } from "./components/VolumeGrid";
import { ElevationBanner } from "./components/ElevationBanner";
import { SfcDismProgressDialog } from "./components/SfcDismProgressDialog";
import { DefenderScanDialog } from "./components/DefenderScanDialog";
import { ChkdskProgressDialog } from "./components/ChkdskProgressDialog";
import { ChkdskFixConfirmDialog } from "./components/ChkdskFixConfirmDialog";
import { ChkdskRebootCountdownDialog } from "./components/ChkdskRebootCountdownDialog";
import { ChkdskPendingBanner } from "./components/ChkdskPendingBanner";
import { ChkdskBootResultBanner } from "./components/ChkdskBootResultBanner";
import { CategoryGrid } from "./components/CategoryGrid";
import { GuidedFixDrawer } from "./components/GuidedFixDrawer";
import { SettingsDialog, applyTheme } from "./components/SettingsDialog";
import { HistoryDialog } from "./components/HistoryDialog";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/Alert";
import { Button } from "./components/ui/Button";
import { SectionTitle } from "./components/ui/SectionTitle";
import {
  executeCleanup,
  isElevated,
  NeedsElevationError,
  openOemLink,
  openSystemPropertiesPerformance,
  recordScan,
  RestoreFailedError,
  runChkdskFix,
  scan,
  VolumeLockedError,
} from "./lib/api";
import { getSettings } from "./lib/settings";
import type { CleanupResult, Finding, ScanReport } from "./lib/types";
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
  const [error, setError] = useState<string | null>(null);
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
  const [historyEnabled, setHistoryEnabled] = useState(true);
  // Faz 1 M4 — Guided (Rehberli) bulgu için açık drawer.
  const [guidedFinding, setGuidedFinding] = useState<Finding | null>(null);
  const updateChecked = useRef(false);

  useEffect(() => {
    isElevated().then(setElevated);
    // Hydrate theme + history flag from persisted settings.
    getSettings()
      .then((s) => {
        applyTheme(s.theme);
        setHistoryEnabled(s.historyEnabled);
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

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setLastResult(null);
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
      setError(`${t("scanFailed")}: ${String(e)}`);
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
        setError(String(e));
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
      setError(`${t("openOemFailed")}: ${String(e)}`);
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

  // Faz 1 — "Hepsini Düzelt": şu an batch'lenebilir tek Auto fix = disk temizliği.
  // Mevcut onay + restore point + cleanup akışını tüm hedeflerle tetikler.
  // (M5'te dedicated run_fix_all + ilerleme/özet dialog'una geçecek.)
  const handleFixAll = useCallback(() => {
    if (!report || report.cleanupTargets.length === 0) return;
    if (!requireElevated(t("elevationRequired"))) return;
    setPendingCleanupIds(report.cleanupTargets.map((target) => target.id));
  }, [report, requireElevated, t]);

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
          // Non-system live result already streamed
          console.info("[chkdsk] /f live complete:", result);
        }
      } catch (e) {
        if (e instanceof NeedsElevationError) {
          setForceElevationBanner(e.message);
        } else if (e instanceof RestoreFailedError) {
          // Sprint 9 review H5 fix: cleanup flow ile aynı recovery banner pattern'i.
          // Kullanıcı "Yine de devam et" (force=true) ile retry edebilir.
          setRestoreErrorChkdsk({ volume, isSystem, message: e.message });
        } else if (e instanceof VolumeLockedError) {
          setError(e.message);
        } else {
          setError(String(e));
        }
      }
    },
    [pendingChkdskFix, requireElevated, t]
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
      setError(String(e));
    }
  }, []);

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

  const handleSettingsClose = async () => {
    setSettingsOpen(false);
    // Re-read settings (history flag may have changed)
    try {
      const s = await getSettings();
      setHistoryEnabled(s.historyEnabled);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen">
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <Header
          elevated={elevated}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
        />

        <ScoreHero
          report={report}
          scanning={scanning}
          fixing={cleaning}
          onScan={runScan}
          onFixAll={handleFixAll}
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

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lastResult && (
          <Alert variant="success" className="mb-4 items-center animate-fade-in">
            <CheckCircle2 />
            <div className="flex-1">
              <AlertTitle>{t("cleanupDone")}</AlertTitle>
              <AlertDescription className="mt-0.5">
                {t("reclaimed")}:{" "}
                <b className="text-foreground">{fmtBytes(lastResult.reclaimedBytes)}</b>
                {lastResult.restorePointCreated && ` · ${t("restorePointCreated")}`}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {report && (
          <>
            <CategoryGrid
              report={report}
              onSelect={() =>
                document
                  .getElementById("issues")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />

            <section className="mb-10">
              <SectionTitle index={1}>{t("drives")}</SectionTitle>
              <VolumeGrid volumes={report.volumes} />
            </section>

            <section id="issues" className="mb-10 scroll-mt-4">
              <SectionTitle index={2}>{t("diagnoseSection")}</SectionTitle>
              {report.findings.length === 0 ? (
                <Alert variant="success">
                  <CheckCircle2 />
                  <div>
                    <AlertTitle>{t("scanHealthyTitle")}</AlertTitle>
                    <AlertDescription className="mt-1">
                      {t("scanHealthyBody")}
                    </AlertDescription>
                  </div>
                </Alert>
              ) : (
                <div className="space-y-2.5">
                  {report.findings.map((f, i) => (
                    <FindingCard
                      key={f.id}
                      finding={f}
                      index={i}
                      onSystemFileCheck={handleSystemFileCheck}
                      onDefenderQuickScan={handleDefenderQuickScan}
                      onChkdskScan={handleChkdskScan}
                      onChkdskFix={handleChkdskFix}
                      onGuided={setGuidedFinding}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="mb-14">
              <SectionTitle index={3}>{t("cleanupSection")}</SectionTitle>
              <CleanupPanel
                targets={report.cleanupTargets}
                totalBytes={report.totalReclaimableBytes}
                busy={cleaning}
                onFix={(ids) => setPendingCleanupIds(ids)}
              />
            </section>
          </>
        )}

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

        <GuidedFixDrawer
          finding={guidedFinding}
          onOpenTarget={handleGuidedOpenTarget}
          onClose={() => setGuidedFinding(null)}
        />
      </div>
    </div>
  );
}
