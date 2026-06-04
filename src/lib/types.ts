export type Severity = "critical" | "warning" | "info" | "good";

/** Faz 1 — bir bulgunun düzeltme katmanı (backend `FixTier` aynası). */
export type FixTier = "auto" | "guided" | "advisory";

/** Sağlık skoru bandı (renk + verdict). */
export type ScoreBand = "excellent" | "good" | "warning" | "critical";

export interface CategoryPenalty {
  category: string;
  penalty: number;
}

export interface HealthScore {
  score: number;
  band: ScoreBand;
  /** i18n verdict kodu; frontend band + sayımlarla yerelleştirir. */
  verdictCode: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  /** Kategori başına götürülen puan, azalan sırada. */
  breakdown: CategoryPenalty[];
}

export type FindingAction =
  | { type: "runSystemFileCheck" }
  | { type: "runDefenderQuickScan" }
  | { type: "runChkdskScan"; volume: string }
  | { type: "runChkdskFix"; volume: string; isSystem: boolean }
  | { type: "openSystemPropertiesPerformance" }
  | { type: "openUrl"; url: string };

export interface VolumeInfo {
  mountPoint: string;
  label: string | null;
  fileSystem: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

/**
 * Sprint 12 K-ext pilot — locale-bağımsız metric kodu.
 * Frontend `metricLabel(metricCode, locale)` ile locale-aware label render eder.
 */
export type MetricCode =
  | { type: "temperatureCelsius"; value: number }
  | { type: "percentage"; value: number }
  | { type: "bytes"; value: number }
  | { type: "count"; value: number }
  | { type: "days"; value: number }
  | { type: "bareString"; text: string };

export interface Finding {
  id: string;
  category: string;
  /** Legacy TR string. Code present → resolveFinding kullanır. */
  title: string;
  description: string;
  severity: Severity;
  metric: string | null;
  recommendedAction: string | null;
  action: FindingAction | null;
  /** Sprint 6 — i18n code (`finding.<cat>.<id>.title`). */
  titleCode?: string;
  descriptionCode?: string;
  actionCode?: string;
  params?: Record<string, string | number> | null;
  /** Sprint 12 K-ext pilot — opsiyonel locale-bağımsız metric kodu */
  metricCode?: MetricCode | null;
  /** Faz 1 — düzeltme katmanı (kartta aksiyonu belirler). Scan her zaman gönderir;
   *  sentetik (history detay) bulgularda olmayabilir → kart `advisory` varsayar. */
  fixTier?: FixTier;
}

export interface CleanupTarget {
  id: string;
  label: string;
  path: string;
  sizeBytes: number;
  itemCount: number;
  description: string;
  reversible: boolean;
}

export interface ScanReport {
  generatedAt: string;
  volumes: VolumeInfo[];
  findings: Finding[];
  cleanupTargets: CleanupTarget[];
  totalReclaimableBytes: number;
  /** Faz 1 — backend'den gelen sağlık skoru. */
  health: HealthScore;
}

// === Faz 1 — "Hepsini Düzelt" orkestrasyonu ===

export type FixSpec = { type: "cleanup"; targetIds: string[] };

export interface FixItemResult {
  id: string;
  ok: boolean;
  messageCode?: string;
  rebootRequired: boolean;
}

export interface FixAllOutcome {
  restorePointCreated: boolean;
  restorePointSkippedReason?: string | null;
  applied: number;
  failed: number;
  items: FixItemResult[];
  rebootRequired: string[];
}

export interface CleanupTargetResult {
  id: string;
  label: string;
  reclaimedBytes: number;
  itemsRemoved: number;
  itemsSkipped: number;
  error: string | null;
}

export interface CleanupResult {
  reclaimedBytes: number;
  perTarget: CleanupTargetResult[];
  restorePointCreated: boolean;
  restorePointSkippedReason: string | null;
}

export interface ProgressLine {
  phase: "DISM" | "SFC";
  text: string;
  percent: number | null;
}

export interface SfcDismSummary {
  dismOk: boolean;
  sfcOk: boolean;
  sfcRepairedFiles: boolean;
  logTail: string;
}

// === Sprint 6 — chkdsk ===

export interface ChkdskProgress {
  volume: string;
  stage: number; // 0-5
  percent: number | null;
  text: string;
}

export type ChkdskStatus =
  | "clean"
  | "errorsFound"
  | "repaired"
  | "scheduled"
  | "scanFailed"
  | "cancelled";

export interface ChkdskResult {
  volume: string;
  exitCode: number;
  status: ChkdskStatus;
  /** Legacy alanı; `status === "errorsFound"` ile aynı. Yeni kod `status` kullansın. */
  errorsFound: boolean;
  durationSeconds: number;
  logTail: string;
}

// === Sprint 8 — chkdsk /f ===

export interface ChkdskFixResult {
  volume: string;
  mode: "live" | "scheduled";
  systemDrive: boolean;
  status: ChkdskStatus;
  exitCode: number;
  errorsFound: boolean;
  durationSeconds: number;
  logTail: string;
  restorePointCreated: boolean;
  restorePointSkippedReason: string | null;
}

export interface PendingChkdsk {
  volume: string;
  scheduledAt: string;
  rebootPending: boolean;
}

export interface ChkdskBootResult {
  volume: string;
  occurredAt: string;
  exitCode: number;
  status: "clean" | "repaired" | "errorsFound" | "unknown";
  summaryLines: string[];
}

export interface ChkdskCancelOutcome {
  scheduleCleared: boolean;
  rebootAborted: boolean;
}

// === Sprint 9 G full — history detail ===

export interface ScanFindingDetail {
  id: number;
  code: string;
  category: string;
  severity: "critical" | "warning" | "info" | "good";
  paramsJson: string | null;
  createdAt: string;
}

// === Sprint 10 T — Trendline ===

export interface DateCount {
  date: string;
  count: number;
}

export interface ThreatDetection {
  threatName: string;
  status: string;
  detectedAt: string;
  processName: string | null;
}

export interface DefenderScanResult {
  scanOk: boolean;
  durationSeconds: number;
  threatsFound: ThreatDetection[];
  error: string | null;
}
