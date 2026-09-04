//! Windows Event Log son 7 günü Provider/EventID'ye göre gruplar.
//!
//! Sprint 2'de PowerShell `Get-WinEvent` sarmalayıcı kullanılıyor — Win32 EventLog
//! API'leri (windows-rs `Win32_System_EventLog`) raw COM çağrıları gerektiriyor,
//! Sprint 1'de PowerShell sarmalayıcı paterni zaten kuruldu (bkz. safety/restore_point.rs).

use crate::diagnostics::util::short_date;
use crate::models::{EventLogSignature, EventSummary};
use crate::util::powershell;

/// Sprint 14 — olay günlüğü paneli: son `days` gündeki TÜM Kritik(1)/Hata(2) olaylarını
/// (yalnız curated provider listesi değil) sağlayıcı+ID'ye göre grupla. PII-GÜVENLİ:
/// mesaj toplanmaz. Sayıya göre azalan, en fazla 40 grup.
pub fn recent_summaries(days: i64) -> Vec<EventSummary> {
    let days = days.clamp(1, 90);
    let script = format!(
        r#"$ErrorActionPreference = 'SilentlyContinue'
$ev = Get-WinEvent -FilterHashtable @{{
    LogName = 'System','Application'
    Level = 1,2
    StartTime = (Get-Date).AddDays(-{days})
}} -MaxEvents 3000 2>$null
if (-not $ev) {{ '[]'; return }}
$grouped = $ev | Group-Object ProviderName, Id | ForEach-Object {{
    $sorted = $_.Group | Sort-Object TimeCreated
    $last = $sorted[-1]
    [PSCustomObject]@{{
        provider     = $last.ProviderName
        eventId      = [int]$last.Id
        level        = [string]$last.LevelDisplayName
        count        = [int]$_.Count
        lastOccurred = $last.TimeCreated.ToString('o')
    }}
}}
$grouped | Sort-Object count -Descending | Select-Object -First 40 | ConvertTo-Json -Compress -Depth 3"#
    );
    let stdout = match powershell::run_cim(&script) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let trimmed = stdout.trim();
    if trimmed.is_empty() || trimmed == "[]" {
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
            let provider = v.get("provider")?.as_str().unwrap_or("").to_string();
            let event_id = v.get("eventId").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let level = v.get("level").and_then(|x| x.as_str()).unwrap_or("Error").to_string();
            let count = v.get("count").and_then(|x| x.as_u64()).unwrap_or(0) as u32;
            let last = v.get("lastOccurred").and_then(|x| x.as_str()).unwrap_or("");
            if provider.is_empty() {
                return None;
            }
            Some(EventSummary {
                provider,
                event_id,
                level,
                count,
                last_occurred: short_date(last),
            })
        })
        .collect()
}

const PROVIDERS: &[&str] = &[
    "Microsoft-Windows-Kernel-Power",
    "Microsoft-Windows-WHEA-Logger",
    "nvlddmkm",
    "amdkmdag",
    "igfx",
    "disk",
    "Ntfs",
    "Application Hang",
    "Application Error",
];

pub fn scan_recent_critical() -> Vec<EventLogSignature> {
    let providers_quoted: Vec<String> = PROVIDERS
        .iter()
        .map(|p| format!("'{}'", p.replace('\'', "''")))
        .collect();
    let providers_list = providers_quoted.join(",");

    let script = format!(
        r#"$ErrorActionPreference = 'SilentlyContinue'
$ev = Get-WinEvent -FilterHashtable @{{
    LogName = 'System','Application'
    ProviderName = {}
    StartTime = (Get-Date).AddDays(-7)
    Level = 1,2,3
}} -MaxEvents 1000 2>$null
if (-not $ev) {{ '[]'; return }}
$grouped = $ev | Group-Object ProviderName, Id | ForEach-Object {{
    $sorted = $_.Group | Sort-Object TimeCreated
    $first = $sorted[0]
    $last = $sorted[-1]
    $msg = ($first.Message -split "`r?`n")[0]
    if ($msg.Length -gt 240) {{ $msg = $msg.Substring(0,240) + '...' }}
    $level = switch ($first.LevelDisplayName) {{
        $null {{ 'Unknown' }}
        default {{ $first.LevelDisplayName }}
    }}
    [PSCustomObject]@{{
        provider       = $first.ProviderName
        eventId        = [int]$first.Id
        level          = $level
        count          = [int]$_.Count
        firstOccurred  = $first.TimeCreated.ToString('o')
        lastOccurred   = $last.TimeCreated.ToString('o')
        sampleMessage  = $msg
    }}
}}
$grouped | ConvertTo-Json -Compress -Depth 3"#,
        providers_list
    );

    let output = powershell::run_cim(&script);
    let stdout = match output {
        Some(s) => s,
        None => return Vec::new(),
    };
    let trimmed = stdout.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        return Vec::new();
    }

    // ConvertTo-Json single-item çıktısı array değil tek object olabilir.
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
        .filter_map(|v| serde_json::from_value::<EventLogSignature>(v).ok())
        .collect()
}

