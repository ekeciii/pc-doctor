//! Başlangıç Finding'leri — Sprint 7 i18n migration.

use crate::models::{Finding, FindingAction, MetricCode, Severity, StartupInfo};
use serde_json::json;

const CATEGORY: &str = "Başlangıç";

pub fn evaluate(info: &StartupInfo) -> Vec<Finding> {
    let mut out = Vec::new();

    if let Some(ms) = info.last_boot_duration_ms {
        let secs = ms / 1000;
        if ms >= 120_000 {
            let mut f = Finding::code_only(
                "startup:slow-critical",
                CATEGORY,
                Severity::Critical,
                "finding.startup.slow_critical.title",
                "finding.startup.slow_critical.description",
            )
            .with_metric(format!("{secs}s"))
            .with_metric_code(MetricCode::Count { value: secs })
            .with_action(FindingAction::OpenUrl {
                url: "ms-settings:startupapps".into(),
            })
            .with_action_code("finding.startup.slow_critical.action")
            .with_params(json!({
                "seconds": secs,
                "milliseconds": ms,
            }));
            f.recommended_action = Some(
                "Başlangıç öğelerini azalt, disk sağlığını kontrol et, son sürücü güncellemelerini gözden geçir."
                    .into(),
            );
            out.push(f);
        } else if ms >= 60_000 {
            let mut f = Finding::code_only(
                "startup:slow-warning",
                CATEGORY,
                Severity::Warning,
                "finding.startup.slow_warning.title",
                "finding.startup.slow_warning.description",
            )
            .with_metric(format!("{secs}s"))
            .with_metric_code(MetricCode::Count { value: secs })
            .with_action(FindingAction::OpenUrl {
                url: "ms-settings:startupapps".into(),
            })
            .with_action_code("finding.startup.slow_warning.action")
            .with_params(json!({
                "seconds": secs,
                "milliseconds": ms,
            }));
            f.recommended_action =
                Some("Başlangıç uygulamalarını azalt, hızlı başlatmayı aktif tut.".into());
            out.push(f);
        }
    }

    let count = info.items.len();
    if count >= 15 {
        let severity = if count >= 25 {
            Severity::Warning
        } else {
            Severity::Info
        };
        let mut f = Finding::code_only(
            "startup:too-many",
            CATEGORY,
            severity,
            "finding.startup.too_many.title",
            "finding.startup.too_many.description",
        )
        .with_metric(count.to_string())
        .with_metric_code(MetricCode::Count { value: count as u64 })
        .with_action(FindingAction::OpenUrl {
            url: "ms-settings:startupapps".into(),
        })
        .with_action_code("finding.startup.too_many.action")
        .with_params(json!({ "count": count }));
        f.recommended_action =
            Some("Ayarlar → Uygulamalar → Başlangıç'tan gerekmeyenleri devre dışı bırak.".into());
        out.push(f);
    }

    out
}
