//! Disk doluluk Finding'leri — Sprint 7 i18n migration.

use crate::models::{Finding, FindingAction, MetricCode, Severity, VolumeInfo};
use serde_json::json;

pub const CATEGORY: &str = "Disk";

pub fn evaluate(volumes: &[VolumeInfo]) -> Vec<Finding> {
    // Temizlik hedeflerinin (TEMP, Update cache, CBS log…) büyük çoğunluğu sistem
    // sürücüsünde olduğundan, tek tık "Yer aç" yalnız sistem sürücüsü için anlamlı.
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    volumes
        .iter()
        .filter_map(|v| {
            // used_percent stale/over-reported gelirse negatif olmasın → 0..=100 clamp.
            let free_percent = (100.0 - v.used_percent).clamp(0.0, 100.0);
            let mount = v.mount_point.trim_end_matches('\\').to_string();
            let is_system_drive = mount.eq_ignore_ascii_case(&system_drive);
            let (severity, code_id, action_text) = if free_percent < 5.0 {
                (
                    Severity::Critical,
                    "full",
                    "Hemen Temp ve Update önbelleğini temizle, gereksiz programları kaldır.",
                )
            } else if free_percent < 10.0 {
                (Severity::Critical, "full", "Tüm temizlik hedeflerini çalıştır.")
            } else if free_percent < 15.0 {
                (
                    Severity::Warning,
                    "warning",
                    "Geçici dosyaları ve güncelleme önbelleğini temizle.",
                )
            } else if free_percent < 20.0 {
                (Severity::Info, "info", "")
            } else {
                return None;
            };
            // `severity` Finding'e taşınmadan önce, temizlik aksiyonu sunulup
            // sunulmayacağını hesapla (Info bandı yalnız bilgi).
            let offer_cleanup = is_system_drive
                && matches!(severity, Severity::Critical | Severity::Warning);
            // used_bytes total'ı aşarsa (reserved/overprovisioned/stale) underflow olmasın.
            let free_bytes = v.total_bytes.saturating_sub(v.used_bytes);
            let mut f = Finding::code_only(
                format!("disk-full:{}", mount),
                CATEGORY,
                severity,
                format!("finding.disk_full.{code_id}.title"),
                format!("finding.disk_full.{code_id}.description"),
            )
            .with_metric(format!("{:.1}%", free_percent))
            .with_metric_code(MetricCode::Percentage { value: free_percent })
            .with_params(json!({
                "mount": mount,
                "freePercent": format!("{:.1}", free_percent),
                "freeFormatted": fmt_bytes(free_bytes),
            }));
            if !action_text.is_empty() {
                f.recommended_action = Some(action_text.to_string());
            }
            // Sistem sürücüsü + gerçekten düşük yer → tek tık temizlik aksiyonu.
            // fix_tier scan'de FixTier::from_action ile merkezi atanır (RunCleanup → Auto).
            if offer_cleanup {
                f.action = Some(FindingAction::RunCleanup);
            }
            Some(f)
        })
        .collect()
}

fn fmt_bytes(b: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    const TB: f64 = GB * 1024.0;
    let b = b as f64;
    if b >= TB {
        format!("{:.1} TB", b / TB)
    } else if b >= GB {
        format!("{:.1} GB", b / GB)
    } else if b >= MB {
        format!("{:.0} MB", b / MB)
    } else if b >= KB {
        format!("{:.0} KB", b / KB)
    } else {
        format!("{} B", b as u64)
    }
}
