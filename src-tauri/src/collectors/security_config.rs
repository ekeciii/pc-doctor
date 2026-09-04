//! Güvenlik konfigürasyonu sanity check'i.

use crate::models::{FirewallProfile, SecurityConfig};
use crate::util::{powershell, system};
use serde::Deserialize;
use std::io::{BufRead, BufReader};

const MAX_HOSTS_BYTES: u64 = 16 * 1024 * 1024;
const MAX_SUSPICIOUS_LINES: usize = 20;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsFirewallProfile {
    name: Option<String>,
    enabled: Option<serde_json::Value>,
}

pub fn collect() -> SecurityConfig {
    let (hosts_count, suspicious) = collect_hosts();
    SecurityConfig {
        firewall_profiles: collect_firewall(),
        third_party_firewall: collect_third_party_firewall(),
        uac_enabled: collect_uac_enabled(),
        uac_consent_level: collect_uac_consent(),
        bitlocker_c_protected: collect_bitlocker(),
        is_laptop: system::is_laptop(),
        dns_servers: collect_dns(),
        hosts_entry_count: hosts_count,
        hosts_suspicious_lines: suspicious,
    }
}

/// `None` = sorgu başarısız (Critical Finding tetikler).
/// `Some(vec)` = profiller okundu (boş olabilir, garip edition'larda).
fn collect_firewall() -> Option<Vec<FirewallProfile>> {
    let script = "Get-NetFirewallProfile -ErrorAction SilentlyContinue | \
                  Select-Object Name, Enabled | ConvertTo-Json -Compress";
    let raw = powershell::run_cim(script)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(arr) => arr,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return None,
    };
    let profiles: Vec<FirewallProfile> = items
        .into_iter()
        .filter_map(|v| serde_json::from_value::<PsFirewallProfile>(v).ok())
        .map(|p| {
            let enabled = match p.enabled {
                Some(serde_json::Value::Bool(b)) => b,
                Some(serde_json::Value::Number(n)) => n.as_u64().unwrap_or(0) == 1,
                Some(serde_json::Value::String(s)) => s.eq_ignore_ascii_case("True"),
                _ => false,
            };
            FirewallProfile {
                name: p.name.unwrap_or_else(|| "(bilinmiyor)".into()),
                enabled,
            }
        })
        .collect();
    Some(profiles)
}

/// Windows Security Center'a kayıtlı aktif + güncel 3. parti firewall (Norton/ESET vs.).
/// Defender bu listededir; "Windows Defender" içeren entry'ler atlanır.
fn collect_third_party_firewall() -> Option<String> {
    let script = "Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName FirewallProduct -ErrorAction SilentlyContinue | \
                  Select-Object displayName, productState | ConvertTo-Json -Compress";
    let raw = powershell::run_cim(script)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(arr) => arr,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return None,
    };
    for item in items {
        let obj = item.as_object()?;
        let name = obj
            .get("displayName")
            .and_then(|n| n.as_str())
            .unwrap_or("");
        let state = obj
            .get("productState")
            .and_then(|n| n.as_u64())
            .unwrap_or(0);
        // productState alt 8 bit subState; 0x1000 = enabled bit ailesi
        let enabled = (state & 0x1000) != 0;
        let up_to_date = (state & 0x00F0) == 0;
        if enabled && up_to_date && !name.to_lowercase().contains("windows defender") {
            return Some(name.to_string());
        }
    }
    None
}

fn collect_uac_enabled() -> Option<bool> {
    let script = "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA";
    let raw = powershell::run_fast(script)?;
    let t = raw.trim();
    if t.is_empty() {
        // Değer kayıp → Windows varsayılanı = açık. None DÖNMEYELİM çünkü bu
        // sessiz başarısızlığı UAC-off sanma sebebi olurdu.
        return Some(true);
    }
    Some(t == "1")
}

fn collect_uac_consent() -> Option<u32> {
    let script = "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name ConsentPromptBehaviorAdmin -ErrorAction SilentlyContinue).ConsentPromptBehaviorAdmin";
    let raw = powershell::run_fast(script)?;
    let t = raw.trim();
    if t.is_empty() {
        return Some(5); // Windows default
    }
    t.parse::<u32>().ok()
}

fn collect_bitlocker() -> Option<bool> {
    let script = "if (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue) { \
                    $v = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction SilentlyContinue; \
                    if ($v) { [int]$v.ProtectionStatus } else { 'NA' } \
                  } else { 'NA' }";
    let raw = powershell::run_cim(script)?;
    let trimmed = raw.trim();
    if trimmed == "NA" || trimmed.is_empty() {
        return None;
    }
    match trimmed {
        "1" => Some(true),
        "0" => Some(false),
        _ => None, // 2 = Unknown
    }
}

fn collect_dns() -> Vec<String> {
    let script = "Get-DnsClientServerAddress -ErrorAction SilentlyContinue | \
                  Where-Object { $_.ServerAddresses.Count -gt 0 -and $_.InterfaceAlias -notmatch 'Loopback' } | \
                  Select-Object -ExpandProperty ServerAddresses -Unique | \
                  ConvertTo-Json -Compress";
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
    match value {
        serde_json::Value::Array(arr) => arr
            .into_iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        serde_json::Value::String(s) => vec![s],
        _ => Vec::new(),
    }
}

/// hosts dosyasını stream halinde okur (devasa adblocker listelerinde OOM olmasın).
/// Loopback olmayan satırlardan en fazla `MAX_SUSPICIOUS_LINES` taneyi döner.
fn collect_hosts() -> (u32, Vec<String>) {
    // Hardcoded yol — UNC injection riskini kapatır (SystemRoot env var atlanıyor).
    let hosts_path = std::path::PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts");
    let file = match std::fs::File::open(&hosts_path) {
        Ok(f) => f,
        Err(_) => return (0, Vec::new()),
    };
    if let Ok(meta) = file.metadata() {
        if meta.len() > MAX_HOSTS_BYTES {
            return (0, Vec::new());
        }
    }
    let reader = BufReader::new(file);
    let mut total: u32 = 0;
    let mut suspicious: Vec<String> = Vec::with_capacity(MAX_SUSPICIOUS_LINES);
    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        total = total.saturating_add(1);
        if suspicious.len() < MAX_SUSPICIOUS_LINES && !is_pure_loopback(trimmed) {
            suspicious.push(trimmed.to_string());
        }
    }
    (total, suspicious)
}

/// 127.0.0.0/8, ::1, 0.0.0.0 (Steven Black ad-blocker) ilk token olarak gelirse "loopback" say.
fn is_pure_loopback(line: &str) -> bool {
    let first = line.split_whitespace().next().unwrap_or("");
    if first.eq_ignore_ascii_case("::1") || first == "0.0.0.0" {
        return true;
    }
    if let Ok(ip) = first.parse::<std::net::Ipv4Addr>() {
        return ip.is_loopback(); // 127.0.0.0/8
    }
    false
}
