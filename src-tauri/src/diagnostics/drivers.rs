//! Flagged sürücüleri Finding'e dönüştürür + OEM linki üretir.
//! Sprint 7: code-only i18n migration; params PII-clean (vendor/model whitelist).

use crate::diagnostics::util::safe_disk_name;
use crate::models::{DriverInfo, Finding, FindingAction, MetricCode, Severity};
use serde_json::json;

pub fn evaluate(drivers: &[DriverInfo]) -> Vec<Finding> {
    drivers.iter().filter_map(to_finding).collect()
}

fn to_finding(d: &DriverInfo) -> Option<Finding> {
    let years = d.age_days as f64 / 365.25;
    let (severity, code_id) = if !d.is_signed {
        (Severity::Critical, "unsigned")
    } else if d.age_days >= 1095 {
        (Severity::Critical, "outdated_critical")
    } else if d.age_days >= 730 {
        (Severity::Warning, "outdated_warning")
    } else {
        return None;
    };

    // Sprint 7 review M3: driverVersion + driverDate kombinasyonu cihaz fingerprint
    // oluşturuyor (vendor catalog + date = unique device). DB'ye yazma; UI'ya da koyma.
    // (bilinmiyor) → "—" locale-neutral em-dash (review H6).
    let params = json!({
        "deviceName": safe_disk_name(&d.device_name),
        "years": format!("{:.1}", years),
        "manufacturer": non_empty(&d.manufacturer, "—"),
        "driverClass": non_empty(&d.class, "—"),
    });

    let url = oem_url(&d.manufacturer, &d.device_name, &d.class);
    let action = url.map(|u| FindingAction::OpenUrl { url: u });
    let action_code = if action.is_some() {
        Some(format!("finding.driver.{code_id}.action"))
    } else {
        None
    };

    let mut f = Finding::code_only(
        format!("driver:{}", sanitize(&d.device_name)),
        "Sürücü",
        severity,
        format!("finding.driver.{code_id}.title"),
        format!("finding.driver.{code_id}.description"),
    )
    .with_metric(if d.is_signed {
        format!("{:.1}y", years)
    } else {
        // Nötr — frontend kategori-spesifik render edebilir.
        "!".to_string()
    })
    .with_metric_code(if d.is_signed {
        MetricCode::Days { value: d.age_days }
    } else {
        MetricCode::BareString { text: "!".into() }
    })
    .with_params(params);
    if let Some(a) = action {
        f = f.with_action(a);
    }
    if let Some(c) = action_code {
        f = f.with_action_code(c);
    }
    f.recommended_action = Some("OEM sitesinden güncel sürücüyü indir ve manuel kur.".into());
    Some(f)
}

fn non_empty(s: &str, fallback: &str) -> String {
    if s.is_empty() {
        fallback.to_string()
    } else {
        s.to_string()
    }
}

fn oem_url(manufacturer: &str, device_name: &str, class: &str) -> Option<String> {
    let m = manufacturer.to_lowercase();
    if m.contains("nvidia") {
        Some("https://www.nvidia.com/Download/index.aspx".into())
    } else if m.contains("amd") || m.contains("ati") || m.contains("advanced micro") {
        Some("https://www.amd.com/en/support".into())
    } else if m.contains("intel") {
        Some("https://www.intel.com/content/www/us/en/support/detect.html".into())
    } else if m.contains("realtek") {
        Some("https://www.realtek.com/en/downloads".into())
    } else if m.contains("microsoft") {
        // Windows Update'un işi — link önermiyoruz
        None
    } else if !manufacturer.is_empty() {
        let q = format!("{} {} {} driver download", manufacturer, device_name, class);
        Some(format!(
            "https://www.google.com/search?q={}",
            urlencoding::encode(&q)
        ))
    } else {
        None
    }
}

fn sanitize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(40)
        .collect()
}
