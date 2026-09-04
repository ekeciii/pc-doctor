//! Chkdsk Finding'leri (code-only).
//! NTFS/disk son 30 günde hata kaydıysa, kullanıcıya `chkdsk /scan` tarama önerir.

use crate::models::{ChkdskVolume, Finding, FindingAction, MetricCode, Severity};
use serde_json::json;

pub const CATEGORY: &str = "Disk bütünlüğü";

pub fn evaluate(volumes: &[ChkdskVolume]) -> Vec<Finding> {
    let mut out = Vec::new();
    // Kolektör tüm fixed NTFS volume'lere aynı sayıyı atar — sum() çoğaltır, max() doğru.
    let total_errors: u32 = volumes.iter().map(|v| v.recent_error_count).max().unwrap_or(0);

    // Tek bir özet Finding — her volume için ayrı kart UI'ı şişirir.
    if total_errors >= 3 {
        // En büyük volume'i öner (genelde C:)
        let target = volumes
            .iter()
            .max_by_key(|v| v.size_bytes)
            .map(|v| v.drive_letter.clone())
            .unwrap_or_else(|| "C".to_string());
        let severity = if total_errors >= 10 {
            Severity::Critical
        } else {
            Severity::Warning
        };
        out.push(
            Finding::code_only(
                format!("chkdsk:errors-detected:{}", target),
                CATEGORY,
                severity,
                "finding.chkdsk.errors_detected.title",
                "finding.chkdsk.errors_detected.description",
            )
            // Nötr metric — Badge'e direkt basıldığı için locale-agnostik tut.
            .with_metric(total_errors.to_string())
            .with_metric_code(MetricCode::Count { value: total_errors as u64 })
            .with_action(FindingAction::RunChkdskScan { volume: target.clone() })
            .with_action_code("finding.chkdsk.errors_detected.action")
            .with_params(json!({
                "volume": target,
                "errorCount": total_errors,
            })),
        );
    }

    out
}
