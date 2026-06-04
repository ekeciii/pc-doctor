//! Başlangıç performansı — boot süresi + startup item listesi.

use crate::models::{StartupInfo, StartupItem};
use crate::util::powershell;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsStartup {
    name: Option<String>,
    command: Option<String>,
    location: Option<String>,
    user: Option<String>,
}

pub fn snapshot() -> StartupInfo {
    StartupInfo {
        last_boot_duration_ms: collect_last_boot_ms(),
        items: collect_startup_items(),
    }
}

/// Microsoft-Windows-Diagnostics-Performance/Operational event 100 → BootTime (ms).
fn collect_last_boot_ms() -> Option<u64> {
    let script = "$ev = Get-WinEvent -LogName 'Microsoft-Windows-Diagnostics-Performance/Operational' \
                       -FilterXPath \"*[System[EventID=100]]\" -MaxEvents 1 -ErrorAction SilentlyContinue; \
                  if ($null -eq $ev) { 'null'; return }; \
                  $xml = [xml]$ev.ToXml(); \
                  ($xml.Event.EventData.Data | Where-Object { $_.Name -eq 'BootTime' }).'#text'";
    let raw = powershell::run_cim(script)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return None;
    }
    trimmed.parse::<u64>().ok()
}

fn collect_startup_items() -> Vec<StartupItem> {
    let script = "Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction SilentlyContinue | \
                  Select-Object Name, Command, Location, User | ConvertTo-Json -Compress -Depth 3";
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
        .filter_map(|v| serde_json::from_value::<PsStartup>(v).ok())
        .filter_map(|p| {
            let name = p.name.filter(|s| !s.is_empty())?;
            Some(StartupItem {
                name,
                command: p.command.unwrap_or_default(),
                location: p.location.unwrap_or_default(),
                user: p.user.unwrap_or_default(),
            })
        })
        .collect()
}
