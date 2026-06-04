import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ChkdskBootResult,
  ChkdskCancelOutcome,
  ChkdskFixResult,
  ChkdskProgress,
  ChkdskResult,
  CleanupResult,
  CleanupTarget,
  DateCount,
  DefenderScanResult,
  FixAllOutcome,
  FixSpec,
  PendingChkdsk,
  ProgressLine,
  ScanFindingDetail,
  ScanReport,
  SfcDismSummary,
} from "./types";

export interface ScanRecord {
  id: number;
  startedAt: string;
  finishedAt: string;
  findingCount: number;
  criticalCount: number;
  warningCount: number;
  severityMax: string;
}

export const NEEDS_ELEVATION_SENTINEL = "NeedsElevation";
export const RESTORE_FAILED_SENTINEL = "RestoreFailed";
export const SCHEDULE_INCONSISTENT_SENTINEL = "ScheduleInconsistent";
export const VOLUME_LOCKED_SENTINEL = "VolumeLocked";

export class NeedsElevationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedsElevationError";
  }
}

/**
 * Sprint 7 (C): System Restore noktası oluşturulamadığında atılır.
 * Frontend bunu yakalar ve "Geri yükleme noktası olmadan devam et" recovery
 * banner'ı gösterir. Locale-agnostic sentinel (eskiden TR substring match).
 */
export class RestoreFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreFailedError";
  }
}

/** Sprint 8: chkntfs OK ama shutdown rollback başarısız → split-brain. */
export class ScheduleInconsistentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleInconsistentError";
  }
}

/** Sprint 8: non-system /f volume in use. */
export class VolumeLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VolumeLockedError";
  }
}

function toError(e: unknown): Error {
  const msg = typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
  if (msg.startsWith(NEEDS_ELEVATION_SENTINEL)) {
    return new NeedsElevationError(msg.slice(NEEDS_ELEVATION_SENTINEL.length + 2));
  }
  if (msg.startsWith(RESTORE_FAILED_SENTINEL)) {
    return new RestoreFailedError(msg.slice(RESTORE_FAILED_SENTINEL.length + 2));
  }
  if (msg.startsWith(SCHEDULE_INCONSISTENT_SENTINEL)) {
    return new ScheduleInconsistentError(
      msg.slice(SCHEDULE_INCONSISTENT_SENTINEL.length + 2)
    );
  }
  if (msg.startsWith(VOLUME_LOCKED_SENTINEL)) {
    return new VolumeLockedError(msg.slice(VOLUME_LOCKED_SENTINEL.length + 2));
  }
  return new Error(msg);
}

export function scan(): Promise<ScanReport> {
  return invoke<ScanReport>("scan").catch((e) => { throw toError(e); });
}

export function listCleanupTargets(): Promise<CleanupTarget[]> {
  return invoke<CleanupTarget[]>("list_cleanup_targets").catch((e) => { throw toError(e); });
}

export function isSystemRestoreEnabled(): Promise<boolean> {
  return invoke<boolean>("is_system_restore_enabled").catch((e) => { throw toError(e); });
}

export function createRestorePoint(description: string): Promise<void> {
  return invoke<void>("create_restore_point", { description }).catch((e) => { throw toError(e); });
}

export function executeCleanup(
  targetIds: string[],
  forceWithoutRestore = false
): Promise<CleanupResult> {
  return invoke<CleanupResult>("execute_cleanup", {
    targetIds,
    forceWithoutRestore,
  }).catch((e) => { throw toError(e); });
}

/**
 * Faz 1 — "Hepsini Düzelt": bir FixSpec listesini tek restore point + tek
 * elevation altında uygular. RestoreFailedError yakalanıp force ile retry edilebilir.
 */
export function runFixAll(
  fixes: FixSpec[],
  forceWithoutRestore = false
): Promise<FixAllOutcome> {
  return invoke<FixAllOutcome>("run_fix_all", { fixes, forceWithoutRestore }).catch((e) => {
    throw toError(e);
  });
}

export function isElevated(): Promise<boolean> {
  return invoke<boolean>("is_elevated").catch(() => false);
}

export function relaunchAsAdmin(): Promise<void> {
  return invoke<void>("relaunch_as_admin").catch((e) => { throw toError(e); });
}

export function runSystemFileCheck(): Promise<SfcDismSummary> {
  return invoke<SfcDismSummary>("run_system_file_check").catch((e) => { throw toError(e); });
}

export function openOemLink(url: string): Promise<void> {
  return invoke<void>("open_oem_link", { url }).catch((e) => { throw toError(e); });
}

export function onSfcDismProgress(handler: (line: ProgressLine) => void): Promise<UnlistenFn> {
  return listen<ProgressLine>("sfc-dism-progress", (e) => handler(e.payload));
}

export function onSfcDismComplete(handler: (summary: SfcDismSummary) => void): Promise<UnlistenFn> {
  return listen<SfcDismSummary>("sfc-dism-complete", (e) => handler(e.payload));
}

export function runDefenderQuickScan(): Promise<DefenderScanResult> {
  return invoke<DefenderScanResult>("run_defender_quick_scan").catch((e) => {
    throw toError(e);
  });
}

export function onDefenderScanStart(handler: () => void): Promise<UnlistenFn> {
  return listen<unknown>("defender-scan-start", () => handler());
}

export function onDefenderScanComplete(
  handler: (result: DefenderScanResult) => void
): Promise<UnlistenFn> {
  return listen<DefenderScanResult>("defender-scan-complete", (e) => handler(e.payload));
}

export function recordScan(report: ScanReport): Promise<number> {
  return invoke<number>("record_scan", { report }).catch((e) => {
    throw toError(e);
  });
}

export function listScans(limit = 50): Promise<ScanRecord[]> {
  return invoke<ScanRecord[]>("list_scans", { limit }).catch((e) => {
    throw toError(e);
  });
}

/** Sprint 9 G full — single scan detail (findings) */
export function listScanFindings(scanId: number): Promise<ScanFindingDetail[]> {
  return invoke<ScanFindingDetail[]>("list_scan_findings", { scanId }).catch((e) => {
    throw toError(e);
  });
}

/** Sprint 10 T — finding code'unun son N gündeki günlük sayısı */
export function scanFindingsTrend(code: string, days = 30): Promise<DateCount[]> {
  return invoke<DateCount[]>("scan_findings_trend", { code, days }).catch(() => []);
}

/** Sprint 11 review H5 — batch: çoklu code tek sorguda (N+1 önleme) */
export function scanFindingsTrendBatch(
  codes: string[],
  days = 30
): Promise<Record<string, DateCount[]>> {
  return invoke<Record<string, DateCount[]>>("scan_findings_trend_batch", {
    codes,
    days,
  }).catch(() => ({}));
}

export function clearHistory(): Promise<void> {
  return invoke<void>("clear_history").catch((e) => {
    throw toError(e);
  });
}

// === Sprint 6 — chkdsk + pagefile launcher ===

export function runChkdskScan(volume: string): Promise<ChkdskResult> {
  return invoke<ChkdskResult>("run_chkdsk_scan", { volume }).catch((e) => {
    throw toError(e);
  });
}

export function onChkdskProgress(
  handler: (p: ChkdskProgress) => void
): Promise<UnlistenFn> {
  return listen<ChkdskProgress>("chkdsk-progress", (e) => handler(e.payload));
}

export function onChkdskComplete(
  handler: (r: ChkdskResult) => void
): Promise<UnlistenFn> {
  return listen<ChkdskResult>("chkdsk-complete", (e) => handler(e.payload));
}

export function openSystemPropertiesPerformance(): Promise<void> {
  return invoke<void>("open_system_properties_performance").catch((e) => {
    throw toError(e);
  });
}

// === Sprint 8 — chkdsk /f ===

export function runChkdskFix(
  volume: string,
  forceWithoutRestore = false
): Promise<ChkdskFixResult> {
  return invoke<ChkdskFixResult>("run_chkdsk_fix", {
    volume,
    forceWithoutRestore,
  }).catch((e) => {
    throw toError(e);
  });
}

export function cancelChkdskSession(): Promise<ChkdskCancelOutcome> {
  return invoke<ChkdskCancelOutcome>("cancel_chkdsk_session").catch((e) => {
    throw toError(e);
  });
}

export function scheduleChkdskReboot(seconds: number): Promise<void> {
  return invoke<void>("schedule_chkdsk_reboot", { seconds }).catch((e) => {
    throw toError(e);
  });
}

export function abortChkdskReboot(): Promise<boolean> {
  return invoke<boolean>("abort_chkdsk_reboot").catch((e) => {
    throw toError(e);
  });
}

export function queryPendingChkdsk(): Promise<PendingChkdsk | null> {
  return invoke<PendingChkdsk | null>("query_pending_chkdsk").catch(() => null);
}

/** Sprint 11 H6 — multi-volume aware: tüm pending volumes listesi */
export function queryPendingChkdsks(): Promise<PendingChkdsk[]> {
  return invoke<PendingChkdsk[]>("query_pending_chkdsks").catch(() => []);
}

export function cancelPendingChkdsk(volume: string): Promise<void> {
  return invoke<void>("cancel_pending_chkdsk", { volume }).catch((e) => {
    throw toError(e);
  });
}

export function fetchLastChkdskResult(volume: string): Promise<ChkdskBootResult | null> {
  return invoke<ChkdskBootResult | null>("fetch_last_chkdsk_result", { volume }).catch(
    () => null
  );
}

export function checkChkdskScheduledVolumes(): Promise<string[]> {
  return invoke<string[]>("check_chkdsk_scheduled_volumes").catch(() => []);
}

/**
 * Sprint 9 review H7: chkntfs OS-truth + pending JSON crosscheck.
 * Eğer registry'de scheduled bir volume varsa ama JSON yoksa (app crash sırasında JSON
 * yazılamadı), banner'ın gösterilebilmesi için JSON'a yaz.
 */
export async function recoverPendingChkdskFromRegistry(): Promise<string[]> {
  const scheduled = await checkChkdskScheduledVolumes();
  return scheduled;
}

export function onChkdskFixComplete(
  handler: (r: ChkdskFixResult) => void
): Promise<UnlistenFn> {
  return listen<ChkdskFixResult>("chkdsk-fix-complete", (e) => handler(e.payload));
}
