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
  | { type: "openUrl"; url: string }
  | { type: "enableFirewall" }
  | { type: "enableUac" }
  | { type: "setPagefileManaged" }
  | { type: "runCleanup" }
  | { type: "guided" };

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
  /** Faz 3 — `recommendedAction`'ın locale-aware karşılığı (`finding.<cat>.<id>.recommendation`). */
  recommendationCode?: string;
  params?: Record<string, string | number> | null;
  /** Sprint 12 K-ext pilot — opsiyonel locale-bağımsız metric kodu */
  metricCode?: MetricCode | null;
  /** Faz 1 — düzeltme katmanı (kartta aksiyonu belirler). Scan her zaman gönderir;
   *  sentetik (history detay) bulgularda olmayabilir → kart `advisory` varsayar. */
  fixTier?: FixTier;
}

// === Sprint 15 — yerel AI sohbeti (Ollama) ===

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// === Sprint 14 — sanal bellek paneli ===

export interface PagefileEntry {
  name: string;
  initialSizeMb: number;
  maximumSizeMb: number;
}

export interface PagefileSnapshot {
  totalRamMb: number;
  automaticManaged: boolean;
  configured: PagefileEntry[];
  allocatedMb: number;
  peakMb: number;
  hibernationEnabled: boolean;
  hiberfilMb: number;
  systemDriveFreeMb: number;
  systemDriveTotalMb: number;
  isLaptop: boolean;
  systemDriveIsSsd: boolean;
}

// === Sprint 14 — çökme geçmişi paneli ===

export interface CrashSignature {
  source: string;
  count: number;
  lastOccurred: string;
}

export interface CrashHistory {
  werCount30d: number;
  reliabilitySignatures: CrashSignature[];
}

// === Sprint 14 — başlangıç paneli ===

export interface StartupItem {
  name: string;
  command: string;
  location: string;
  user: string;
}

export interface StartupInfo {
  lastBootDurationMs: number | null;
  items: StartupItem[];
}

// === Sprint 14 — güncellemeler paneli ===

export interface PendingUpdate {
  source: string;
  title: string;
  severity: string | null;
  isSecurity: boolean;
  kb: string | null;
}

export interface UpdateSnapshot {
  windowsUpdates: PendingUpdate[] | null;
  wingetUpgradeCount: number | null;
}

// === Sprint 14 — güvenlik konfigi panosu ===

export interface FirewallProfile {
  name: string;
  enabled: boolean;
}

export interface SecurityConfig {
  firewallProfiles: FirewallProfile[] | null;
  thirdPartyFirewall: string | null;
  uacEnabled: boolean | null;
  uacConsentLevel: number | null;
  bitlockerCProtected: boolean | null;
  isLaptop: boolean;
  dnsServers: string[];
  hostsEntryCount: number;
  hostsSuspiciousLines: string[];
}

// === Sprint 14 — termal panel ===

export interface ThermalSnapshot {
  zonesCelsius: number[];
  processorPerformancePercentAvg: number | null;
  processorLoadPercentAvg: number | null;
  isLaptop: boolean;
  onAcPower: boolean | null;
}

// === Sprint 14 — Defender durum panosu ===

export interface DefenderStatus {
  realTimeProtection: boolean;
  tamperProtection: boolean;
  antivirusEnabled: boolean;
  behaviorMonitor: boolean;
  lastQuickScanDays: number | null;
  lastFullScanDays: number | null;
  signatureAgeDays: number | null;
  activeThreatCount: number;
}

export interface DefenderOverview {
  available: boolean;
  status: DefenderStatus | null;
  recentThreats: ThreatDetection[];
}

// === Sprint 14 — sürücü paneli ===

export interface DriverInfo {
  deviceName: string;
  manufacturer: string;
  driverVersion: string;
  driverDate: string;
  isSigned: boolean;
  class: string;
  ageDays: number;
}

// === Sprint 14 — olay günlüğü özet paneli ===

export interface EventSummary {
  provider: string;
  eventId: number;
  level: string; // "Critical" | "Error"
  count: number;
  lastOccurred: string; // YYYY-MM-DD
}

// === Sprint 14 — disk bütünlüğü (chkdsk) sürücü paneli ===

export interface IntegrityVolume {
  driveLetter: string;
  fileSystem: string;
  sizeBytes: number;
  freeBytes: number;
  isSystem: boolean;
}

// === Sprint 14 — disk sağlığı (SMART) telemetrisi ===

export interface SmartDisk {
  friendlyName: string;
  mediaType: string;
  healthStatus: string;
  operationalStatus: string;
  sizeBytes: number;
  busType: string;
  temperatureCelsius: number | null;
  wearPercent: number | null;
  readErrorsTotal: number | null;
  writeErrorsTotal: number | null;
  powerOnHours: number | null;
}

// === Sprint 14 — büyük/kullanılmayan dosya tarayıcısı ===

export interface LargeFile {
  path: string;
  name: string;
  directory: string;
  sizeBytes: number;
  lastAccessedDays: number | null;
  lastModifiedDays: number | null;
}

export interface DriveFileScan {
  drive: string;
  scannedFiles: number;
  skippedDirs: number;
  largeFiles: LargeFile[];
  unusedFiles: LargeFile[];
  error: string | null;
}

export interface FileDeleteError {
  path: string;
  message: string;
}

export interface FileDeleteResult {
  deleted: number;
  failed: number;
  reclaimedBytes: number;
  errors: FileDeleteError[];
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

/** Backend `fix-all-progress` event'i — batch'te şu an çalışan adım. */
export interface FixAllProgress {
  /** FixSpec.id() — "cleanup" | "enableFirewall" | "defenderQuickScan" | "systemFileCheck" | … */
  id: string;
  index: number;
  total: number;
}

export type FixSpec =
  | { type: "cleanup"; targetIds: string[] }
  | { type: "enableFirewall" }
  | { type: "enableUac" }
  | { type: "setPagefileManaged" }
  | { type: "runDefenderQuickScan" }
  | { type: "runSystemFileCheck" };

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
  "clean" | "errorsFound" | "repaired" | "scheduled" | "scanFailed" | "cancelled";

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
  /** `shutdown /a` gerçekten başarısızsa hata mesajı (split-brain: autochk iptal
   *  edildi ama reboot hâlâ planlı olabilir). null = abort başarılı / reboot yoktu. */
  rebootAbortError: string | null;
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
