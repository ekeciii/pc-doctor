//! Event Log signature'larını Finding'e dönüştürür — Sprint 7 i18n migration.
//! sample_message ASLA yazılmaz (PII invariant): yalnız provider/event_id/count/short_date.

use crate::diagnostics::util::short_date;
use crate::models::{EventLogSignature, Finding, FindingAction, MetricCode, Severity};
use serde_json::json;

pub const CATEGORY: &str = "Olay günlüğü";

pub fn evaluate(signatures: &[EventLogSignature]) -> Vec<Finding> {
    signatures.iter().filter_map(classify).collect()
}

fn classify(sig: &EventLogSignature) -> Option<Finding> {
    let provider = sig.provider.to_ascii_lowercase();
    let id = sig.event_id;
    let n = sig.count;
    let last_date = short_date(&sig.last_occurred);

    // Kernel-Power 41
    if provider.contains("kernel-power") && id == 41 && n >= 1 {
        let severity = if n >= 3 {
            Severity::Critical
        } else {
            Severity::Warning
        };
        let action = if n >= 3 {
            Some(FindingAction::RunSystemFileCheck)
        } else {
            None
        };
        return Some(make_finding(
            sig,
            severity,
            "finding.event_log.kernel_power_41",
            json!({ "count": n, "lastOccurredDate": last_date }),
            true,
            action,
        ));
    }

    // WHEA-Logger / BugCheck
    if provider.contains("whea-logger") || provider.contains("bugcheck") {
        let severity = if n >= 2 {
            Severity::Critical
        } else {
            Severity::Warning
        };
        return Some(make_finding(
            sig,
            severity,
            "finding.event_log.whea_or_bugcheck",
            json!({
                "provider": sig.provider.clone(),
                "count": n,
                "lastOccurredDate": last_date,
            }),
            true,
            Some(FindingAction::RunSystemFileCheck),
        ));
    }

    // GPU driver
    if (provider.contains("nvlddmkm") || provider.contains("amdkmdag") || provider.contains("igfx"))
        && n >= 3
    {
        let severity = if n >= 10 {
            Severity::Critical
        } else {
            Severity::Warning
        };
        // Sprint 7 review M4: gpu_driver_error.action dict'te tanımlı — vendor-specific
        // URL üret (drivers.rs OEM mapping pattern'iyle uyumlu).
        let url = if provider.contains("nvlddmkm") {
            "https://www.nvidia.com/Download/index.aspx"
        } else if provider.contains("amdkmdag") {
            "https://www.amd.com/en/support"
        } else {
            "https://www.intel.com/content/www/us/en/support/detect.html"
        };
        return Some(make_finding(
            sig,
            severity,
            "finding.event_log.gpu_driver_error",
            json!({
                "gpuVendor": sig.provider.clone(),
                "count": n,
                "lastOccurredDate": last_date,
            }),
            true,
            Some(FindingAction::OpenUrl { url: url.into() }),
        ));
    }

    // Disk / Ntfs
    if (provider == "disk" || provider == "ntfs") && n >= 3 {
        let severity = if n >= 10 {
            Severity::Critical
        } else {
            Severity::Warning
        };
        return Some(make_finding(
            sig,
            severity,
            "finding.event_log.disk_or_ntfs_error",
            json!({
                "subsystem": sig.provider.clone(),
                "count": n,
                "lastOccurredDate": last_date,
            }),
            true,
            Some(FindingAction::RunSystemFileCheck),
        ));
    }

    // Application hang/error
    if (provider == "application hang" || provider == "application error") && n >= 10 {
        let event_kind = if provider == "application hang" {
            "hang"
        } else {
            "error"
        };
        return Some(make_finding(
            sig,
            Severity::Warning,
            "finding.event_log.application_crash",
            json!({
                "count": n,
                "eventKind": event_kind,
                "lastOccurredDate": last_date,
            }),
            false,
            None,
        ));
    }

    None
}

fn make_finding(
    sig: &EventLogSignature,
    severity: Severity,
    code_prefix: &str,
    params: serde_json::Value,
    has_recommendation: bool,
    action: Option<FindingAction>,
) -> Finding {
    let mut f = Finding::code_only(
        format!("event-log:{}:{}", sig.provider, sig.event_id),
        CATEGORY,
        severity,
        format!("{code_prefix}.title"),
        format!("{code_prefix}.description"),
    )
    .with_metric(short_date(&sig.last_occurred))
    .with_metric_code(MetricCode::BareString {
        text: short_date(&sig.last_occurred),
    })
    .with_params(params);
    if let Some(a) = action {
        f = f.with_action(a);
        f = f.with_action_code(format!("{code_prefix}.action"));
    }
    if has_recommendation {
        f.recommendation_code = Some(format!("{code_prefix}.recommendation"));
    }
    f
}
