//! Bekleyen güncellemeler — Windows Update COM + winget upgrade.
//!
//! Windows Update online search 5-25 sn sürebilir; 30 sn timeout.
//! winget upgrade source-refresh ile 5-15 sn; 20 sn timeout.

use crate::models::{PendingUpdate, UpdateSnapshot};
use crate::util::powershell;
use serde::Deserialize;
use std::time::Duration;

pub fn snapshot() -> UpdateSnapshot {
    UpdateSnapshot {
        windows_updates: collect_windows_updates(),
        winget_upgrade_count: collect_winget_upgrade_count(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct WuRow {
    title: Option<String>,
    severity: Option<String>,
    is_mandatory: Option<bool>,
    kb: Option<String>,
}

fn collect_windows_updates() -> Option<Vec<PendingUpdate>> {
    let script = "$session = New-Object -ComObject Microsoft.Update.Session; \
                  $searcher = $session.CreateUpdateSearcher(); \
                  $searcher.Online = $true; \
                  try { $result = $searcher.Search(\"IsInstalled=0 and Type='Software' and IsHidden=0\") } \
                  catch { 'null'; return }; \
                  $result.Updates | ForEach-Object { \
                    [PSCustomObject]@{ \
                      Title = $_.Title; \
                      Severity = $_.MsrcSeverity; \
                      IsMandatory = $_.IsMandatory; \
                      KB = (($_.KBArticleIDs | ForEach-Object { \"KB$_\" }) -join ',') \
                    } \
                  } | ConvertTo-Json -Compress -Depth 3";
    let raw = powershell::run_with_timeout(script, Duration::from_secs(30))?;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Some(Vec::new());
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(arr) => arr,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return Some(Vec::new()),
    };
    Some(
        items
            .into_iter()
            .filter_map(|v| serde_json::from_value::<WuRow>(v).ok())
            .filter_map(|r| {
                let title = r.title?;
                let is_mandatory = r.is_mandatory.unwrap_or(false);
                let lower = title.to_lowercase();
                let is_security = is_mandatory
                    || lower.contains("security")
                    || lower.contains("güvenlik");
                Some(PendingUpdate {
                    source: "WindowsUpdate".into(),
                    title,
                    severity: r.severity,
                    is_security,
                    kb: r.kb.filter(|s| !s.is_empty()),
                })
            })
            .collect(),
    )
}

/// `winget upgrade` çıktısının son satırlarındaki "X upgrades available." mesajından
/// veya tablo gövdesinden upgrade sayısını çıkarır.
fn collect_winget_upgrade_count() -> Option<u32> {
    let script = "if (Get-Command winget -ErrorAction SilentlyContinue) { \
                    winget upgrade --include-unknown --accept-source-agreements --disable-interactivity 2>&1 | Out-String \
                  } else { 'NA' }";
    let raw = powershell::run_with_timeout(script, Duration::from_secs(20))?;
    let trimmed = raw.trim();
    if trimmed == "NA" || trimmed.is_empty() {
        return None;
    }

    // 1) "X upgrades available" / "X yükseltme mevcut" / "X uygulama" trailer satırı (locale değişebilir)
    for line in trimmed.lines() {
        if let Some(n) = parse_count_from_trailer(line) {
            return Some(n);
        }
    }

    // 2) Fallback: tablo header altındaki '---' satırından sonraki veri satırlarını say.
    let lines: Vec<&str> = trimmed.lines().collect();
    let dashes_idx = lines.iter().position(|l| l.trim().starts_with("---"));
    if let Some(idx) = dashes_idx {
        let count = lines
            .iter()
            .skip(idx + 1)
            .take_while(|l| !l.trim().is_empty() && !l.contains("upgrade") && !l.contains("yükseltme"))
            // Sadece bir id alanı görünüyorsa veri satırı say
            .filter(|l| l.split_whitespace().count() >= 3)
            .count() as u32;
        return Some(count);
    }

    Some(0)
}

fn parse_count_from_trailer(line: &str) -> Option<u32> {
    let trimmed = line.trim();
    let lower = trimmed.to_lowercase();
    let has_keyword = lower.contains("upgrade available")
        || lower.contains("upgrades available")
        || lower.contains("yükseltme mevcut")
        || lower.contains("yükseltme bulundu");
    if !has_keyword {
        return None;
    }
    let n: String = trimmed.chars().take_while(|c| c.is_ascii_digit()).collect();
    n.parse::<u32>().ok()
}
