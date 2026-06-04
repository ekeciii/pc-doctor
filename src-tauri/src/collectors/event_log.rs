//! Windows Event Log son 7 günü Provider/EventID'ye göre gruplar.
//!
//! Sprint 2'de PowerShell `Get-WinEvent` sarmalayıcı kullanılıyor — Win32 EventLog
//! API'leri (windows-rs `Win32_System_EventLog`) raw COM çağrıları gerektiriyor,
//! Sprint 1'de PowerShell sarmalayıcı paterni zaten kuruldu (bkz. safety/restore_point.rs).

use crate::models::EventLogSignature;
use crate::util::powershell;

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

