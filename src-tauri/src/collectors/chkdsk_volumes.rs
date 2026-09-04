//! NTFS fixed volume enumeration + Event Log Ntfs/Disk hata cross-reference.
//! Sprint 6 — chkdsk /scan suggestion.

use crate::models::{ChkdskVolume, IntegrityVolume};
use crate::util::powershell;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsVolume {
    drive_letter: Option<String>,
    file_system: Option<String>,
    size: Option<u64>,
    size_remaining: Option<u64>,
}

pub fn collect() -> Vec<ChkdskVolume> {
    let script = r#"
        $ErrorActionPreference = 'SilentlyContinue'
        # NTFS fixed drives only (DriveType=3=Fixed)
        $vols = Get-Volume | Where-Object {
            $_.DriveType -eq 'Fixed' -and
            $_.FileSystem -eq 'NTFS' -and
            $_.DriveLetter
        } | Select-Object DriveLetter, FileSystem, Size, SizeRemaining
        $vols | ConvertTo-Json -Compress -Depth 3
    "#;
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
    let mut out: Vec<ChkdskVolume> = items
        .into_iter()
        .filter_map(|v| serde_json::from_value::<PsVolume>(v).ok())
        .filter_map(|v| {
            let letter = v.drive_letter.filter(|s| !s.is_empty())?;
            Some(ChkdskVolume {
                drive_letter: letter.to_uppercase(),
                file_system: v.file_system.unwrap_or_default(),
                size_bytes: v.size.unwrap_or(0),
                free_bytes: v.size_remaining.unwrap_or(0),
                recent_error_count: 0,
            })
        })
        .collect();

    // Event Log cross-reference: son 30 günde Ntfs/disk EventID 55/98/130
    let error_counts = collect_error_counts();
    for vol in out.iter_mut() {
        // disk hataları volume'a değil disk'e bağlı — yine de toplam sayıyı
        // tüm fixed NTFS volume'lere ekleyerek aday liste oluşturuyoruz.
        // Daha rafine eşleştirme Sprint 7'de.
        vol.recent_error_count = error_counts;
    }

    out
}

/// Sprint 11 review H3 fix — lightweight: yalnız Get-Volume PowerShell sorgusu, Event Log YOK.
/// `check_chkdsk_scheduled_volumes` gibi salt-letter callsite'ları kullanmalı.
pub fn list_fixed_ntfs_drive_letters() -> Vec<String> {
    let script = r#"
        $ErrorActionPreference = 'SilentlyContinue'
        $vols = Get-Volume | Where-Object {
            $_.DriveType -eq 'Fixed' -and
            $_.FileSystem -eq 'NTFS' -and
            $_.DriveLetter
        } | Select-Object -ExpandProperty DriveLetter
        $vols | ConvertTo-Json -Compress
    "#;
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
    let letters: Vec<String> = match value {
        serde_json::Value::Array(arr) => arr
            .into_iter()
            .filter_map(|v| match v {
                serde_json::Value::String(s) => Some(s),
                serde_json::Value::Number(n) => n.as_u64().map(|u| (u as u8 as char).to_string()),
                _ => None,
            })
            .collect(),
        serde_json::Value::String(s) => vec![s],
        _ => Vec::new(),
    };
    letters
        .into_iter()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_uppercase())
        .collect()
}

/// Sprint 14 — disk bütünlüğü paneli için sabit NTFS sürücüler (boyut + sistem bayrağı).
/// Event Log sorgusu YOK → hızlı. Tarama/onarım kullanıcı tarafından tetiklenir.
pub fn list_integrity_volumes() -> Vec<IntegrityVolume> {
    let system_letter = std::env::var("SystemDrive")
        .ok()
        .and_then(|d| d.chars().next())
        .map(|c| c.to_ascii_uppercase())
        .unwrap_or('C');

    let script = r#"
        $ErrorActionPreference = 'SilentlyContinue'
        $vols = Get-Volume | Where-Object {
            $_.DriveType -eq 'Fixed' -and
            $_.FileSystem -eq 'NTFS' -and
            $_.DriveLetter
        } | Select-Object DriveLetter, FileSystem, Size, SizeRemaining
        $vols | ConvertTo-Json -Compress -Depth 3
    "#;
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
        .filter_map(|v| serde_json::from_value::<PsVolume>(v).ok())
        .filter_map(|v| {
            let letter = v.drive_letter.filter(|s| !s.is_empty())?.to_uppercase();
            let is_system = letter.starts_with(system_letter);
            Some(IntegrityVolume {
                drive_letter: letter,
                file_system: v.file_system.unwrap_or_else(|| "NTFS".into()),
                size_bytes: v.size.unwrap_or(0),
                free_bytes: v.size_remaining.unwrap_or(0),
                is_system,
            })
        })
        .collect()
}

fn collect_error_counts() -> u32 {
    let script = r#"
        $start = (Get-Date).AddDays(-30)
        $ev = Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            ProviderName = 'disk','Ntfs','Microsoft-Windows-Ntfs'
            StartTime = $start
            Level = 1,2,3
        } -MaxEvents 500 -ErrorAction SilentlyContinue
        if ($null -eq $ev) { 0; return }
        @($ev).Count
    "#;
    powershell::run_cim(script)
        .and_then(|s| s.trim().parse::<u32>().ok())
        .unwrap_or(0)
}
