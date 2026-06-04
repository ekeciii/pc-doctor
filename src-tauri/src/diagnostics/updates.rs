//! Updates snapshot'tan Finding üret — Sprint 7 i18n migration.
//! PII guard (Sprint 7 review H3): WU title KB no + ürün adı + (bazen) kullanıcı yolları içerebilir,
//! Sample params'a YAZILMAZ — kullanıcı Settings → Windows Update'ten kendi görür.

use crate::models::{Finding, FindingAction, MetricCode, PendingUpdate, Severity, UpdateSnapshot};
use serde_json::json;

const CATEGORY: &str = "Güncelleme";

pub fn evaluate(snap: &UpdateSnapshot) -> Vec<Finding> {
    let mut out = Vec::new();

    if let Some(wu) = &snap.windows_updates {
        let security: Vec<&PendingUpdate> = wu.iter().filter(|u| u.is_security).collect();
        let total = wu.len();
        if !security.is_empty() {
            let count = security.len() as u32;
            let mut f = Finding::code_only(
                "updates:wu-security",
                CATEGORY,
                Severity::Critical,
                "finding.updates.wu_security.title",
                "finding.updates.wu_security.description",
            )
            .with_metric(count.to_string())
            .with_metric_code(MetricCode::Count { value: count as u64 })
            .with_action(FindingAction::OpenUrl {
                url: "ms-settings:windowsupdate".into(),
            })
            .with_action_code("finding.updates.wu_security.action")
            .with_params(json!({
                "count": count,
            }));
            f.recommended_action = Some("Windows Update'i aç ve indirme & kurmayı başlat.".into());
            out.push(f);
        } else if total >= 10 {
            let mut f = Finding::code_only(
                "updates:wu-many",
                CATEGORY,
                Severity::Warning,
                "finding.updates.wu_many.title",
                "finding.updates.wu_many.description",
            )
            .with_metric(total.to_string())
            .with_metric_code(MetricCode::Count { value: total as u64 })
            .with_action(FindingAction::OpenUrl {
                url: "ms-settings:windowsupdate".into(),
            })
            .with_action_code("finding.updates.wu_many.action")
            .with_params(json!({ "count": total }));
            f.recommended_action = Some(
                "Windows Update'ten birikenleri kur. PC'yi yeniden başlatman gerekebilir.".into(),
            );
            out.push(f);
        } else if total >= 1 {
            out.push(
                Finding::code_only(
                    "updates:wu-some",
                    CATEGORY,
                    Severity::Info,
                    "finding.updates.wu_some.title",
                    "finding.updates.wu_some.description",
                )
                .with_metric(total.to_string())
                .with_metric_code(MetricCode::Count { value: total as u64 })
                .with_action(FindingAction::OpenUrl {
                    url: "ms-settings:windowsupdate".into(),
                })
                .with_action_code("finding.updates.wu_some.action")
                .with_params(json!({ "count": total })),
            );
        }
    }

    if let Some(count) = snap.winget_upgrade_count {
        if count >= 1 {
            let severity = if count >= 20 {
                Severity::Warning
            } else {
                Severity::Info
            };
            let mut f = Finding::code_only(
                "updates:winget",
                CATEGORY,
                severity,
                "finding.updates.winget.title",
                "finding.updates.winget.description",
            )
            .with_metric(count.to_string())
            .with_metric_code(MetricCode::Count { value: count as u64 })
            .with_params(json!({ "count": count }));
            f.recommended_action =
                Some("Terminal'de `winget upgrade --all` ile hepsini güncelleyebilirsin.".into());
            out.push(f);
        }
    }

    out
}
