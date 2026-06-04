//! Defender durumu + tehdit listesinden Finding üretir.
//! Sprint 7: code-only i18n; PII whitelist (threat_name title/description'a yazılmaz).

use crate::models::{DefenderStatus, Finding, FindingAction, MetricCode, Severity, ThreatDetection};
use serde_json::json;

const CATEGORY: &str = "Virüs";

pub fn evaluate(status: &DefenderStatus, threats: &[ThreatDetection]) -> Vec<Finding> {
    let mut out = Vec::new();

    // Aktif tehdit varsa en üst
    let active: Vec<&ThreatDetection> = threats
        .iter()
        .filter(|t| matches!(t.status.as_str(), "Detected" | "Active" | "Allowed"))
        .collect();
    if !active.is_empty() {
        let count = active.len() as u32;
        let f = Finding::code_only(
            "defender:active-threats",
            CATEGORY,
            Severity::Critical,
            "finding.defender.active_threats.title",
            "finding.defender.active_threats.description",
        )
        .with_metric(count.to_string())
        .with_metric_code(MetricCode::Count { value: count as u64 })
        .with_action(FindingAction::RunDefenderQuickScan)
        .with_action_code("finding.defender.active_threats.action")
        .with_params(json!({ "threatCount": count }));
        out.push(with_recommend(f, "Defender Hızlı Tarama çalıştır."));
    }

    if !status.real_time_protection {
        let f = Finding::code_only(
            "defender:rt-off",
            CATEGORY,
            Severity::Critical,
            "finding.defender.rt_off.title",
            "finding.defender.rt_off.description",
        )
        .with_metric("!")
        .with_metric_code(MetricCode::BareString { text: "!".into() })
        .with_action(FindingAction::RunDefenderQuickScan)
        .with_action_code("finding.defender.rt_off.action");
        out.push(with_recommend(
            f,
            "Defender Hızlı Tarama çalıştır + gerçek zamanlı korumayı aç.",
        ));
    } else if !status.antivirus_enabled {
        let f = Finding::code_only(
            "defender:av-off",
            CATEGORY,
            Severity::Warning,
            "finding.defender.av_off.title",
            "finding.defender.av_off.description",
        )
        .with_metric("!")
        .with_metric_code(MetricCode::BareString { text: "!".into() });
        out.push(f);
    }

    if !status.tamper_protection {
        let f = Finding::code_only(
            "defender:tamper-off",
            CATEGORY,
            Severity::Warning,
            "finding.defender.tamper_off.title",
            "finding.defender.tamper_off.description",
        )
        .with_metric("!")
        .with_metric_code(MetricCode::BareString { text: "!".into() })
        .with_action(FindingAction::OpenUrl {
            url: "windowsdefender://threat".into(),
        })
        .with_action_code("finding.defender.tamper_off.action");
        out.push(with_recommend(
            f,
            "Windows Güvenlik → Virüs ve tehdit koruması → Ayarları yönet bölümünden aç.",
        ));
    }

    if let Some(age) = status.signature_age_days {
        if age > 7 {
            let severity = if age > 30 {
                Severity::Critical
            } else {
                Severity::Warning
            };
            let f = Finding::code_only(
                "defender:sig-stale",
                CATEGORY,
                severity,
                "finding.defender.sig_stale.title",
                "finding.defender.sig_stale.description",
            )
            .with_metric(age.to_string())
            .with_metric_code(MetricCode::Days { value: age })
            .with_action(FindingAction::OpenUrl {
                url: "ms-settings:windowsupdate".into(),
            })
            .with_action_code("finding.defender.sig_stale.action")
            .with_params(json!({ "ageDays": age }));
            out.push(with_recommend(
                f,
                "Windows Update üzerinden imza güncellemesi çek.",
            ));
        }
    }

    if let Some(age) = status.last_quick_scan_days {
        if age > 14 && active.is_empty() && status.real_time_protection {
            let f = Finding::code_only(
                "defender:scan-stale",
                CATEGORY,
                Severity::Warning,
                "finding.defender.scan_stale.title",
                "finding.defender.scan_stale.description",
            )
            .with_metric(age.to_string())
            .with_metric_code(MetricCode::Days { value: age })
            .with_action(FindingAction::RunDefenderQuickScan)
            .with_action_code("finding.defender.scan_stale.action")
            .with_params(json!({ "ageDays": age }));
            out.push(with_recommend(f, "Defender Hızlı Tarama çalıştır."));
        }
    }

    out
}

fn with_recommend(mut f: Finding, msg: &str) -> Finding {
    f.recommended_action = Some(msg.to_string());
    f
}
