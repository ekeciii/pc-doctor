//! SMART/disk Finding'leri üret — Sprint 7 i18n migration.

use crate::diagnostics::util::safe_disk_name;
use crate::models::{Finding, FindingAction, MetricCode, Severity, SmartDisk};
use serde_json::json;

pub const CATEGORY: &str = "Disk sağlığı";

pub fn evaluate(disks: &[SmartDisk]) -> Vec<Finding> {
    disks.iter().flat_map(classify).collect()
}

fn classify(d: &SmartDisk) -> Vec<Finding> {
    let mut out = Vec::new();
    let disk_name = safe_disk_name(&d.friendly_name);

    // Sağlık durumu
    if d.health_status != "Healthy" && d.health_status != "(bilinmiyor)" {
        let severity = if d.health_status.eq_ignore_ascii_case("Unhealthy") {
            Severity::Critical
        } else {
            Severity::Warning
        };
        let mut f = Finding::code_only(
            format!("smart:health:{}", safe_id(&d.friendly_name)),
            CATEGORY,
            severity,
            "finding.smart.health.title",
            "finding.smart.health.description",
        )
        .with_metric(d.health_status.clone())
        .with_metric_code(MetricCode::BareString {
            text: d.health_status.clone(),
        })
        .with_action(FindingAction::Guided)
        .with_action_code("finding.smart.health.action")
        .with_params(json!({
            "diskName": disk_name.clone(),
            "healthStatus": d.health_status.clone(),
            "operationalStatus": d.operational_status.clone(),
        }));
        f.recommended_action = Some("Hemen veri yedeği al; üretici tanı aracını çalıştır.".into());
        out.push(f);
    }

    // SSD aşınma
    if let Some(w) = d.wear_percent {
        if w > 0 {
            let severity = if w >= 95 {
                Severity::Critical
            } else if w >= 80 {
                Severity::Warning
            } else if w >= 60 {
                Severity::Info
            } else {
                return out;
            };
            let mut f = Finding::code_only(
                format!("smart:wear:{}", safe_id(&d.friendly_name)),
                CATEGORY,
                severity,
                "finding.smart.wear.title",
                "finding.smart.wear.description",
            )
            .with_metric(format!("{w}%"))
            .with_metric_code(MetricCode::Percentage { value: w as f64 })
            .with_action(FindingAction::Guided)
            .with_action_code("finding.smart.wear.action")
            .with_params(json!({
                "diskName": disk_name.clone(),
                "wearPercent": w,
            }));
            f.recommended_action = Some(if w >= 80 {
                "Önemli dosyalarını hemen yedekle ve SSD değişimini planla.".into()
            } else {
                "Önemli dosyaların düzenli yedeğini al; aşınma ilerledikçe değişimi planla.".into()
            });
            out.push(f);
        }
    }

    // Sıcaklık
    if let Some(t) = d.temperature_celsius {
        if t >= 70 {
            let severity = if t >= 80 {
                Severity::Critical
            } else {
                Severity::Warning
            };
            let mut f = Finding::code_only(
                format!("smart:temp:{}", safe_id(&d.friendly_name)),
                CATEGORY,
                severity,
                "finding.smart.temperature.title",
                "finding.smart.temperature.description",
            )
            .with_metric(format!("{t}°C"))
            .with_metric_code(MetricCode::TemperatureCelsius { value: t as f64 })
            .with_action(FindingAction::Guided)
            .with_action_code("finding.smart.temperature.action")
            .with_params(json!({
                "diskName": disk_name.clone(),
                "temperatureC": t,
            }));
            f.recommended_action = Some(
                "Kasanın hava akışını ve disk konumunu kontrol et; cihaz NVMe ise heatsink önerilir.".into(),
            );
            out.push(f);
        }
    }

    // Read/Write hataları
    let read_err = d.read_errors_total.unwrap_or(0);
    let write_err = d.write_errors_total.unwrap_or(0);
    if read_err >= 100 || write_err >= 100 {
        let mut f = Finding::code_only(
            format!("smart:errors:{}", safe_id(&d.friendly_name)),
            CATEGORY,
            Severity::Critical,
            "finding.smart.io_errors.title",
            "finding.smart.io_errors.description",
        )
        .with_metric(format!("{read_err}R / {write_err}W"))
        .with_metric_code(MetricCode::Count {
            value: read_err.saturating_add(write_err),
        })
        .with_action(FindingAction::Guided)
        .with_action_code("finding.smart.io_errors.action")
        .with_params(json!({
            "diskName": disk_name,
            "readErrors": read_err,
            "writeErrors": write_err,
        }));
        f.recommended_action =
            Some("Hemen yedek al; chkdsk taraması çalıştır.".into());
        out.push(f);
    }

    out
}

fn safe_id(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(40)
        .collect()
}
