use serde::{Deserialize, Serialize};

/// Sprint 12 K-ext pilot — locale-bağımsız metric değer kodu.
/// Frontend `metricLabelFromCode(metricCode, locale)` ile locale-aware label render eder.
///
/// Backwards compat: `Finding.metric: Option<String>` field korunur (Sprint 7+8 emit pattern).
/// Sprint 13'te kalan 10 detector migrate edilecek.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MetricCode {
    TemperatureCelsius { value: f64 },
    Percentage { value: f64 },
    Bytes { value: u64 },
    Count { value: u64 },
    Days { value: i64 },
    BareString { text: String },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Severity {
    Critical,
    Warning,
    Info,
    #[default]
    Good,
}

/// Faz 1 — bir bulgunun nasıl düzeltileceğini ilan eder (sağlık-dashboard çatısı).
/// - `Auto`: app onay + System Restore noktasıyla değişikliği kendisi uygular (geri alınabilir).
/// - `Guided`: app doğru ayar yerini açar + adım adım anlatır; değişikliği kullanıcı yapar.
/// - `Advisory`: yalnız bilgi (donanım/log), otomatik aksiyon yok.
///
/// Default `Advisory` — bilinçli olarak `Auto`/`Guided` işaretlenmeyen her bulgu güvenli
/// tarafta (yalnız bilgi) kalır.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FixTier {
    Auto,
    Guided,
    #[default]
    Advisory,
}

impl FixTier {
    /// Bir bulgunun aksiyonundan varsayılan düzeltme katmanını türetir (Faz 1 merkezi atama).
    /// App'in kendisinin uyguladığı aksiyonlar `Auto`; kullanıcıyı bir yere yönlendirenler
    /// `Guided`; aksiyonsuz bulgular `Advisory`. Faz 2'de bulgular `with_fix_tier` ile bunu
    /// açıkça geçersiz kılabilir (örn. firewall'u `Auto`'ya yükseltme).
    pub fn from_action(action: Option<&FindingAction>) -> FixTier {
        match action {
            Some(FindingAction::RunSystemFileCheck)
            | Some(FindingAction::RunDefenderQuickScan)
            | Some(FindingAction::RunChkdskScan { .. })
            | Some(FindingAction::RunChkdskFix { .. }) => FixTier::Auto,
            Some(FindingAction::OpenSystemPropertiesPerformance)
            | Some(FindingAction::OpenUrl { .. }) => FixTier::Guided,
            None => FixTier::Advisory,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub mount_point: String,
    pub label: Option<String>,
    pub file_system: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub used_percent: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub id: String,
    pub category: String,
    /// Legacy TR string. Yeni Sprint 6+ kolektörleri `title_code` kullanır.
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub metric: Option<String>,
    pub recommended_action: Option<String>,
    pub action: Option<FindingAction>,
    /// Sprint 6: i18n code (dot-namespaced: `finding.<cat>.<id>.title`).
    /// Frontend `resolveFinding` code'u varsa kullanır, yoksa legacy `title` fallback.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_code: Option<String>,
    /// Param map: `{drive}` gibi placeholder'lar için. PII-clean.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
    /// Sprint 12 K-ext pilot — locale-bağımsız metric kodu (opsiyonel).
    /// Frontend bunu metric String fallback'inden önce dener.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metric_code: Option<MetricCode>,
    /// Faz 1 — düzeltme katmanı. Frontend kartta katmana göre aksiyon gösterir
    /// (Auto→Düzelt, Guided→Nasıl?, Advisory→Detay) ve `Auto` olanlar "Hepsini Düzelt"e girer.
    #[serde(default)]
    pub fix_tier: FixTier,
}

impl Finding {
    /// Code-only Finding constructor — title/description boş string, frontend code resolve eder.
    pub fn code_only(
        id: impl Into<String>,
        category: impl Into<String>,
        severity: Severity,
        title_code: impl Into<String>,
        description_code: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            category: category.into(),
            title: String::new(),
            description: String::new(),
            severity,
            metric: None,
            recommended_action: None,
            action: None,
            title_code: Some(title_code.into()),
            description_code: Some(description_code.into()),
            action_code: None,
            params: None,
            metric_code: None,
            fix_tier: FixTier::Advisory,
        }
    }

    pub fn with_metric(mut self, metric: impl Into<String>) -> Self {
        self.metric = Some(metric.into());
        self
    }

    /// Faz 1 — düzeltme katmanını set et (Auto/Guided/Advisory).
    pub fn with_fix_tier(mut self, tier: FixTier) -> Self {
        self.fix_tier = tier;
        self
    }

    pub fn with_action(mut self, action: FindingAction) -> Self {
        self.action = Some(action);
        self
    }

    pub fn with_action_code(mut self, code: impl Into<String>) -> Self {
        self.action_code = Some(code.into());
        self
    }

    pub fn with_params(mut self, params: serde_json::Value) -> Self {
        self.params = Some(params);
        self
    }

    /// Sprint 12 K-ext pilot — locale-bağımsız metric kodu set et.
    pub fn with_metric_code(mut self, code: MetricCode) -> Self {
        self.metric_code = Some(code);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FindingAction {
    /// Frontend: DÜZELT butonu → sfc/DISM modal'ı açar
    RunSystemFileCheck,
    /// Frontend: "Hızlı Tarama" butonu → Defender Quick Scan modal'ı açar
    RunDefenderQuickScan,
    /// Frontend: chkdsk /scan dialog'unu açar (Sprint 6)
    RunChkdskScan { volume: String },
    /// Sprint 8 — chkdsk /f (non-system live veya system scheduled reboot)
    RunChkdskFix { volume: String, is_system: bool },
    /// Frontend: SystemPropertiesPerformance.exe launcher (Sprint 6 — pagefile)
    OpenSystemPropertiesPerformance,
    /// Frontend: "OEM sitesine git" / "Settings'i aç" → tarayıcı veya Settings URI
    OpenUrl { url: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLogSignature {
    pub provider: String,
    pub event_id: u32,
    pub level: String,
    pub count: u32,
    pub first_occurred: String,
    pub last_occurred: String,
    pub sample_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverInfo {
    pub device_name: String,
    pub manufacturer: String,
    pub driver_version: String,
    pub driver_date: String,
    pub is_signed: bool,
    pub class: String,
    pub age_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressLine {
    pub phase: String, // "DISM" | "SFC"
    pub text: String,
    pub percent: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SfcDismSummary {
    pub dism_ok: bool,
    pub sfc_ok: bool,
    pub sfc_repaired_files: bool,
    pub log_tail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DefenderStatus {
    pub real_time_protection: bool,
    pub tamper_protection: bool,
    pub antivirus_enabled: bool,
    pub behavior_monitor: bool,
    pub last_quick_scan_days: Option<i64>,
    pub last_full_scan_days: Option<i64>,
    pub signature_age_days: Option<i64>,
    pub active_threat_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatDetection {
    pub threat_name: String,
    pub status: String,
    pub detected_at: String,
    pub process_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefenderScanResult {
    pub scan_ok: bool,
    pub duration_seconds: u64,
    pub threats_found: Vec<ThreatDetection>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartDisk {
    pub friendly_name: String,
    pub media_type: String,
    pub health_status: String,
    pub operational_status: String,
    pub size_bytes: u64,
    pub bus_type: String,
    pub temperature_celsius: Option<i32>,
    pub wear_percent: Option<u8>,
    pub read_errors_total: Option<u64>,
    pub write_errors_total: Option<u64>,
    pub power_on_hours: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThermalSnapshot {
    pub zones_celsius: Vec<f64>,
    pub processor_performance_percent_avg: Option<f64>,
    /// CPU yükü (`% Processor Utility`). Throttling sadece yük varsa anlamlı.
    pub processor_load_percent_avg: Option<f64>,
    pub is_laptop: bool,
    /// None = masaüstü; Some(true) = laptop AC'de; Some(false) = laptop bataryada
    pub on_ac_power: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirewallProfile {
    pub name: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingUpdate {
    pub source: String,           // "WindowsUpdate" | "winget"
    pub title: String,
    pub severity: Option<String>, // "Critical" | "Important" | "Moderate" | "Low"
    pub is_security: bool,
    pub kb: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnapshot {
    /// `None` = Windows Update sorgusu yapılamadı / zaman aşımı; `Some(vec)` = cache'den okundu.
    pub windows_updates: Option<Vec<PendingUpdate>>,
    /// `None` = winget yok ya da hata; `Some(n)` = upgrade'i olan paket sayısı.
    pub winget_upgrade_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    pub name: String,
    pub command: String,
    pub location: String, // örn. "HKLM\\...\\Run"
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StartupInfo {
    pub last_boot_duration_ms: Option<u64>,
    pub items: Vec<StartupItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashSignature {
    pub source: String,
    pub count: u32,
    pub last_occurred: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CrashHistory {
    pub wer_count_30d: u32,
    pub reliability_signatures: Vec<CrashSignature>,
}

// === Sprint 6 — pagefile ===

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PagefileEntry {
    pub name: String,
    /// MB cinsinden initial / max size (0 = system managed)
    pub initial_size_mb: u32,
    pub maximum_size_mb: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PagefileSnapshot {
    pub total_ram_mb: u64,
    /// AutomaticManagedPagefile (Win32_ComputerSystem)
    pub automatic_managed: bool,
    pub configured: Vec<PagefileEntry>,
    /// Win32_PageFileUsage — runtime kullanım.
    pub allocated_mb: u64,
    pub peak_mb: u64,
    pub hibernation_enabled: bool,
    pub hiberfil_mb: u64,
    pub system_drive_free_mb: u64,
    pub system_drive_total_mb: u64,
    pub is_laptop: bool,
    pub system_drive_is_ssd: bool,
}

// === Sprint 6 — chkdsk ===

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChkdskVolume {
    pub drive_letter: String,
    pub file_system: String,
    pub size_bytes: u64,
    pub free_bytes: u64,
    /// Event Log Ntfs/Disk EventID 55/98/130 son 30 günde.
    pub recent_error_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChkdskProgress {
    pub volume: String,
    pub stage: u8, // 1-5
    pub percent: Option<u8>,
    pub text: String,
}

/// chkdsk /scan tamamlanma durumu. Sprint 6 — exit_code mapping explicit.
/// Microsoft chkdsk doc: 0=Clean, 1=found+fixed (read-only /scan'de gelmemeli ama defensif),
/// 2=disk cleanup not performed (online scan'de "errors found, not repaired" anlamına gelir),
/// 3=could not check (admin/lock/cancel), diğer = beklenmedik.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChkdskStatus {
    Clean,
    ErrorsFound,
    /// Sprint 8 — `/f` ile düzeltildi (exit 1)
    Repaired,
    /// Sprint 8 — system disk autochk planlandı (next reboot)
    Scheduled,
    ScanFailed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChkdskResult {
    pub volume: String,
    pub exit_code: i32,
    pub status: ChkdskStatus,
    /// Legacy alanı — `status == ErrorsFound`. Frontend yeni kullanım için `status` tercih etsin.
    pub errors_found: bool,
    pub duration_seconds: u64,
    pub log_tail: String,
}

// === Sprint 8 — chkdsk /f remediation ===

/// `mode`: "live" (non-system /f canlı) veya "scheduled" (system /f autochk planlandı)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChkdskFixResult {
    pub volume: String,
    pub mode: String,
    pub system_drive: bool,
    pub status: ChkdskStatus,
    pub exit_code: i32,
    pub errors_found: bool,
    pub duration_seconds: u64,
    pub log_tail: String,
    pub restore_point_created: bool,
    pub restore_point_skipped_reason: Option<String>,
}

/// `pending_chkdsk.json` persistence — Settings'ten AYRI (invariant #17).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingChkdsk {
    pub volume: String,
    pub scheduled_at: String,
    pub reboot_pending: bool,
}

/// Wininit EventID 1001 parse sonucu. PII-safe (paths scrub edilmiş).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChkdskBootResult {
    pub volume: String,
    pub occurred_at: String,
    pub exit_code: i32,
    pub status: String,
    pub summary_lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChkdskCancelOutcome {
    pub schedule_cleared: bool,
    pub reboot_aborted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecurityConfig {
    /// None = sorgu başarısız (Critical Finding'i tetikler), Some([]) = profile yok.
    pub firewall_profiles: Option<Vec<FirewallProfile>>,
    /// Windows Security Center'a göre 3. parti firewall display name (Norton/ESET/vb.).
    pub third_party_firewall: Option<String>,
    /// None = registry okunamadı, Some(false) = açıkça kapalı, Some(true) = açık veya default.
    pub uac_enabled: Option<bool>,
    pub uac_consent_level: Option<u32>,
    pub bitlocker_c_protected: Option<bool>,
    pub is_laptop: bool,
    pub dns_servers: Vec<String>,
    pub hosts_entry_count: u32,
    pub hosts_suspicious_lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupTarget {
    pub id: String,
    pub label: String,
    pub path: String,
    pub size_bytes: u64,
    pub item_count: u64,
    pub description: String,
    pub reversible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub generated_at: String,
    pub volumes: Vec<VolumeInfo>,
    pub findings: Vec<Finding>,
    pub cleanup_targets: Vec<CleanupTarget>,
    pub total_reclaimable_bytes: u64,
    /// Faz 1 — bulgulardan hesaplanan 0-100 sağlık skoru (backend tek kaynak).
    /// `#[serde(default)]`: eski/eksik raporlar `record_scan`'de hâlâ deserialize olur.
    #[serde(default)]
    pub health: crate::health::HealthScore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub reclaimed_bytes: u64,
    pub per_target: Vec<CleanupTargetResult>,
    pub restore_point_created: bool,
    pub restore_point_skipped_reason: Option<String>,
}

// === Faz 1 — "Hepsini Düzelt" orkestrasyonu ===

/// Frontend'in `run_fix_all`'a gönderdiği tek bir düzeltme isteği.
/// Faz 1: yalnız `Cleanup`. Faz 2'de yeni varyantlar eklenir
/// (DisableStartupItem, EnableFirewall, SetPagefileManaged, …) ve orkestratör
/// otomatik kapsar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FixSpec {
    Cleanup { target_ids: Vec<String> },
}

impl FixSpec {
    /// Bu fix'in kararlı kimliği (sonuçlarda + reboot grubunda kullanılır).
    pub fn id(&self) -> &'static str {
        match self {
            FixSpec::Cleanup { .. } => "cleanup",
        }
    }
    /// Bu fix uygulandıktan sonra yeniden başlatma gerekiyor mu? (Faz 2: pagefile → true.)
    pub fn requires_reboot(&self) -> bool {
        match self {
            FixSpec::Cleanup { .. } => false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixItemResult {
    pub id: String,
    pub ok: bool,
    /// Başarı/hata özeti için i18n kodu (opsiyonel).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_code: Option<String>,
    pub reboot_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixAllOutcome {
    pub restore_point_created: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restore_point_skipped_reason: Option<String>,
    pub applied: u32,
    pub failed: u32,
    pub items: Vec<FixItemResult>,
    /// Yeniden başlatma isteyen fix id'leri (frontend ayrı grup gösterir, sessiz reboot YOK).
    pub reboot_required: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupTargetResult {
    pub id: String,
    pub label: String,
    pub reclaimed_bytes: u64,
    pub items_removed: u64,
    pub items_skipped: u64,
    pub error: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
    #[error("PowerShell: {0}")]
    PowerShell(String),
    #[error("UTF-8: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("Forbidden path: {0}")]
    ForbiddenPath(String),
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}
