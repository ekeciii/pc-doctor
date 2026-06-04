//! Donma/çökme geçmişi: WER report klasörleri + Win32_ReliabilityRecords.

use crate::models::{CrashHistory, CrashSignature};
use crate::util::powershell;
use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsReliability {
    name: Option<String>,
    count: Option<u32>,
    last: Option<String>,
}

pub fn snapshot() -> CrashHistory {
    CrashHistory {
        wer_count_30d: count_wer_reports_last_30_days(),
        reliability_signatures: collect_reliability(),
    }
}

fn count_wer_reports_last_30_days() -> u32 {
    let dirs = [
        r"C:\ProgramData\Microsoft\Windows\WER\ReportArchive",
        r"C:\ProgramData\Microsoft\Windows\WER\ReportQueue",
    ];
    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    let mut total: u32 = 0;
    for dir in dirs {
        let path = std::path::Path::new(dir);
        if !path.exists() {
            continue;
        }
        let entries = match std::fs::read_dir(path) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if !meta.is_dir() {
                    continue;
                }
                if let Ok(modified) = meta.modified() {
                    let dt: chrono::DateTime<chrono::Utc> = modified.into();
                    if dt > cutoff {
                        total = total.saturating_add(1);
                    }
                }
            }
        }
    }
    total
}

/// Win32_ReliabilityRecords son 30 günü gruplar. Reliability Monitor servisi
/// devre dışıysa boş döner. WMI yavaş olabilir; 30 s timeout.
fn collect_reliability() -> Vec<CrashSignature> {
    let script = "$start = (Get-Date).AddDays(-30); \
                  $records = Get-CimInstance Win32_ReliabilityRecords -ErrorAction SilentlyContinue | \
                    Where-Object { $_.TimeGenerated -gt $start }; \
                  if ($null -eq $records) { '[]'; return }; \
                  $records | Group-Object SourceName | ForEach-Object { \
                    $last = ($_.Group | Sort-Object TimeGenerated -Descending | Select-Object -First 1).TimeGenerated; \
                    [PSCustomObject]@{ \
                      Name = $_.Name; \
                      Count = [int]$_.Count; \
                      Last = $last.ToString('o') \
                    } \
                  } | Sort-Object Count -Descending | Select-Object -First 10 | ConvertTo-Json -Compress -Depth 3";
    let raw = match powershell::run_with_timeout(script, Duration::from_secs(30)) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "[]" || trimmed == "null" {
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
        .filter_map(|v| serde_json::from_value::<PsReliability>(v).ok())
        .filter_map(|r| {
            Some(CrashSignature {
                source: r.name?,
                count: r.count.unwrap_or(0),
                last_occurred: r.last.unwrap_or_default(),
            })
        })
        .collect()
}
