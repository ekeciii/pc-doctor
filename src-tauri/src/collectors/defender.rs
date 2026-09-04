//! Windows Defender (Microsoft Defender Antivirus) durumu + son tehditler.

use crate::models::{DefenderStatus, ThreatDetection};
use crate::util::powershell;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct MpStatus {
    real_time_protection_enabled: Option<bool>,
    is_tamper_protected: Option<bool>,
    antivirus_enabled: Option<bool>,
    behavior_monitor_enabled: Option<bool>,
    quick_scan_age: Option<i64>,          // days
    full_scan_age: Option<i64>,           // days
    antivirus_signature_age: Option<i64>, // days
}

pub fn collect_status() -> Option<DefenderStatus> {
    let script = "Get-MpComputerStatus -ErrorAction SilentlyContinue | \
                  Select-Object RealTimeProtectionEnabled, IsTamperProtected, \
                                AntivirusEnabled, BehaviorMonitorEnabled, \
                                QuickScanAge, FullScanAge, AntivirusSignatureAge | \
                  ConvertTo-Json -Compress";
    let raw = powershell::run_cim(script)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let s: MpStatus = serde_json::from_str(trimmed).ok()?;
    Some(DefenderStatus {
        real_time_protection: s.real_time_protection_enabled.unwrap_or(false),
        tamper_protection: s.is_tamper_protected.unwrap_or(false),
        antivirus_enabled: s.antivirus_enabled.unwrap_or(false),
        behavior_monitor: s.behavior_monitor_enabled.unwrap_or(false),
        last_quick_scan_days: s.quick_scan_age,
        last_full_scan_days: s.full_scan_age,
        signature_age_days: s.antivirus_signature_age,
        active_threat_count: 0, // collect_threats ile doldurulur
    })
}

pub fn collect_recent_threats() -> Vec<ThreatDetection> {
    let script = "Get-MpThreatDetection -ErrorAction SilentlyContinue | \
                  Sort-Object InitialDetectionTime -Descending | Select-Object -First 20 \
                    @{N='ThreatName';E={(Get-MpThreat -ThreatID $_.ThreatID -ErrorAction SilentlyContinue).ThreatName}}, \
                    @{N='Status';E={$_.ThreatStatusID}}, \
                    @{N='DetectedAt';E={$_.InitialDetectionTime.ToString('o')}}, \
                    @{N='ProcessName';E={$_.ProcessName}} | \
                  ConvertTo-Json -Compress -Depth 3";
    let raw = match powershell::run_cim(script) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Vec::new();
    }
    let value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(arr) => arr,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return Vec::new(),
    };
    items
        .into_iter()
        .filter_map(|v| {
            let obj = v.as_object()?;
            let threat_name = obj
                .get("ThreatName")
                .and_then(|n| n.as_str())
                .unwrap_or("(bilinmiyor)")
                .to_string();
            let status = obj
                .get("Status")
                .map(status_label)
                .unwrap_or_else(|| "(bilinmiyor)".into());
            let detected_at = obj
                .get("DetectedAt")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            let process_name = obj
                .get("ProcessName")
                .and_then(|n| n.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());
            Some(ThreatDetection {
                threat_name,
                status,
                detected_at,
                process_name,
            })
        })
        .collect()
}

fn status_label(v: &serde_json::Value) -> String {
    // ThreatStatusID değerleri: https://learn.microsoft.com/.../msft-mpthreat
    let id = v.as_u64().unwrap_or(0);
    match id {
        0 => "Unknown".into(),
        1 => "Detected".into(),
        2 => "Cleaned".into(),
        3 => "Quarantined".into(),
        4 => "Removed".into(),
        5 => "Allowed".into(),
        6 => "Blocked".into(),
        102 => "Active".into(),
        _ => format!("Status_{}", id),
    }
}
