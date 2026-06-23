//! Termal snapshot'tan Finding üret — Sprint 7 i18n migration.
//! Throttling Finding'leri yalnızca CPU yük altındaysa VE AC güçteyse tetiklenir.

use crate::models::{Finding, FindingAction, MetricCode, Severity, ThermalSnapshot};
use serde_json::json;

pub const CATEGORY: &str = "Donanım";

pub fn evaluate(snap: &ThermalSnapshot) -> Vec<Finding> {
    let mut out = Vec::new();

    // === Sıcaklık ===
    if let Some(max_temp) = snap.zones_celsius.iter().cloned().fold(None, |acc: Option<f64>, t| {
        Some(acc.map_or(t, |m| m.max(t)))
    }) {
        let zone_count = snap.zones_celsius.len();
        if max_temp >= 85.0 {
            out.push(make_temp_finding(
                "thermal:critical",
                "critical",
                Severity::Critical,
                max_temp,
                zone_count,
                "Kasayı aç, fanları/havalandırmayı temizle; termal macunu kontrol et. \
                 Laptop ise yükseltici stand + soğutma pedi.",
            ));
        } else if max_temp >= 75.0 {
            out.push(make_temp_finding(
                "thermal:warning",
                "warning",
                Severity::Warning,
                max_temp,
                zone_count,
                "Toz temizliği ve hava akışı kontrolü öner.",
            ));
        }
    }

    // === Throttling ===
    let perf = snap.processor_performance_percent_avg;
    let load = snap.processor_load_percent_avg;
    let on_ac = snap.on_ac_power.unwrap_or(true);

    if let (Some(p), Some(l)) = (perf, load) {
        if on_ac && l >= 50.0 {
            if p < 70.0 {
                let mut f = Finding::code_only(
                    "thermal:throttling-critical",
                    CATEGORY,
                    Severity::Critical,
                    "finding.thermal.throttling_critical.title",
                    "finding.thermal.throttling_critical.description",
                )
                .with_metric(format!("{:.0}%", p))
                .with_metric_code(MetricCode::Percentage { value: p })
                .with_action(FindingAction::OpenUrl {
                    url: "ms-settings:powersleep".into(),
                })
                .with_action_code("finding.thermal.throttling_critical.action")
                .with_params(json!({
                    "perfPercent": format!("{:.0}", p),
                    "loadPercent": format!("{:.0}", l),
                }));
                f.recommended_action = Some(
                    "Güç planını 'En iyi performans' yap; soğutma kontrolü; BIOS güncelle.".into(),
                );
                out.push(f);
            } else if p < 90.0 {
                let mut f = Finding::code_only(
                    "thermal:throttling-warning",
                    CATEGORY,
                    Severity::Warning,
                    "finding.thermal.throttling_warning.title",
                    "finding.thermal.throttling_warning.description",
                )
                .with_metric(format!("{:.0}%", p))
                .with_metric_code(MetricCode::Percentage { value: p })
                .with_action(FindingAction::OpenUrl {
                    url: "ms-settings:powersleep".into(),
                })
                .with_action_code("finding.thermal.throttling_warning.action")
                .with_params(json!({
                    "perfPercent": format!("{:.0}", p),
                    "loadPercent": format!("{:.0}", l),
                }));
                f.recommended_action = Some("Güç planı kontrolü; toz temizliği.".into());
                out.push(f);
            }
        }
    }

    out
}

fn make_temp_finding(
    id: &str,
    code_id: &str,
    severity: Severity,
    max_temp: f64,
    zone_count: usize,
    action_text: &str,
) -> Finding {
    let mut f = Finding::code_only(
        id,
        CATEGORY,
        severity,
        format!("finding.thermal.{code_id}.title"),
        format!("finding.thermal.{code_id}.description"),
    )
    .with_metric(format!("{:.0}°C", max_temp))
    .with_metric_code(MetricCode::TemperatureCelsius { value: max_temp })
    .with_action(FindingAction::Guided)
    .with_action_code(format!("finding.thermal.{code_id}.action"))
    .with_params(json!({
        "maxTemp": format!("{:.0}", max_temp),
        "maxTempPrecise": format!("{:.1}", max_temp),
        "zoneCount": zone_count,
    }));
    f.recommended_action = Some(action_text.into());
    f
}
