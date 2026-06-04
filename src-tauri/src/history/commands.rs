//! Scan history Tauri commands. All disk I/O via spawn_blocking.

use crate::diagnostics::util::sanitize_params;
use crate::history::{retention, HistoryDb};
use crate::models::ScanReport;
use crate::settings::SettingsState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Sprint 7 G partial + review H5: Finding'i `scan_findings` tablosuna serialize ederken
/// `diagnostics/util::sanitize_params(category, params)` ÇİĞNENEMEZ defansif katmandan
/// geçer. Backend disiplini bir yerde bozulsa bile DB'de PII kalmaz (DENY list + per-category
/// ALLOW list). Backend invaryant: emit edilen Finding zaten PII-clean olmalı; bu katman
/// belt-and-braces.
fn severity_str(s: &crate::models::Severity) -> &'static str {
    match s {
        crate::models::Severity::Critical => "critical",
        crate::models::Severity::Warning => "warning",
        crate::models::Severity::Info => "info",
        crate::models::Severity::Good => "good",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRecord {
    pub id: i64,
    pub started_at: String,
    pub finished_at: String,
    pub finding_count: u32,
    pub critical_count: u32,
    pub warning_count: u32,
    pub severity_max: String,
}

/// Sprint 9 G full — `list_scan_findings(scan_id)` row mapping.
/// params_json: Sprint 7 sanitize_params'tan ZATEN geçmiş (DB-clean). Frontend ek filter gerekmez.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFindingDetail {
    pub id: i64,
    pub code: String,
    pub category: String,
    pub severity: String,
    pub params_json: Option<String>,
    pub created_at: String,
}

/// Sprint 10 T — trendline aggregation result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DateCount {
    pub date: String,
    pub count: u32,
}

#[tauri::command]
pub async fn record_scan(
    db: State<'_, HistoryDb>,
    settings: State<'_, SettingsState>,
    report: ScanReport,
) -> Result<i64, String> {
    use crate::models::Severity;

    let finding_count = report.findings.len() as u32;
    let critical_count = report
        .findings
        .iter()
        .filter(|f| matches!(f.severity, Severity::Critical))
        .count() as u32;
    let warning_count = report
        .findings
        .iter()
        .filter(|f| matches!(f.severity, Severity::Warning))
        .count() as u32;
    let severity_max = report
        .findings
        .iter()
        .map(|f| match f.severity {
            Severity::Critical => 0,
            Severity::Warning => 1,
            Severity::Info => 2,
            Severity::Good => 3,
        })
        .min()
        .map(|m| match m {
            0 => "critical",
            1 => "warning",
            2 => "info",
            _ => "good",
        })
        .unwrap_or("good")
        .to_string();

    let started = report.generated_at.clone();
    let finished = chrono::Utc::now().to_rfc3339();
    let retention_days = settings.snapshot().history_retention_days;

    // Sprint 7 G partial + review H5: finding rows için pre-serialize.
    // params_json ÖNCE sanitize_params(category, ...) defansif katmandan geçer.
    let findings_rows: Vec<(String, String, String, Option<String>)> = report
        .findings
        .iter()
        .filter_map(|f| {
            // Kod yoksa (Sprint <7 legacy emit) yazma — UI yok zaten.
            let code = f.title_code.clone()?;
            let params_json = f.params.as_ref().map(|v| {
                let sanitized = sanitize_params(&f.category, v);
                sanitized.to_string()
            });
            Some((
                code,
                f.category.clone(),
                severity_str(&f.severity).to_string(),
                params_json,
            ))
        })
        .collect();

    let conn = db.conn.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<i64, String> {
        let mut guard = conn.lock().map_err(|e| e.to_string())?;

        // Birincil retention enforcement — INSERT öncesi (best-effort).
        if let Err(e) = retention::enforce(&guard, retention_days) {
            eprintln!("[history] retention skip: {e}");
        }

        // Atomicity: scan + findings tek tx — ya hepsi yazılır ya hiçbiri.
        let tx = guard
            .transaction()
            .map_err(|e| format!("tx hatası: {e}"))?;
        tx
            .execute(
                "INSERT INTO scans (started_at, finished_at, finding_count, critical_count, warning_count, severity_max)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![started, finished, finding_count, critical_count, warning_count, severity_max],
            )
            .map_err(|e| format!("insert hatası: {e}"))?;
        let scan_id = tx.last_insert_rowid();

        if !findings_rows.is_empty() {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO scan_findings (scan_id, code, category, severity, params_json, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                )
                .map_err(|e| format!("findings prepare hatası: {e}"))?;
            for (code, category, severity, params_json) in &findings_rows {
                stmt.execute(rusqlite::params![
                    scan_id,
                    code,
                    category,
                    severity,
                    params_json,
                    finished
                ])
                .map_err(|e| format!("findings insert hatası: {e}"))?;
            }
        }

        tx.commit().map_err(|e| format!("commit hatası: {e}"))?;
        Ok(scan_id)
    })
    .await
    .map_err(|e| format!("join hatası: {e}"))?
}

#[tauri::command]
pub async fn list_scans(
    db: State<'_, HistoryDb>,
    limit: Option<u32>,
) -> Result<Vec<ScanRecord>, String> {
    let limit = limit.unwrap_or(50).clamp(1, 500);
    let conn = db.conn.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<ScanRecord>, String> {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = guard
            .prepare(
                "SELECT id, started_at, finished_at, finding_count, critical_count, warning_count, severity_max
                 FROM scans ORDER BY id DESC LIMIT ?1",
            )
            .map_err(|e| format!("prepare hatası: {e}"))?;
        let rows = stmt
            .query_map([limit], |row| {
                Ok(ScanRecord {
                    id: row.get(0)?,
                    started_at: row.get(1)?,
                    finished_at: row.get(2)?,
                    finding_count: row.get(3)?,
                    critical_count: row.get(4)?,
                    warning_count: row.get(5)?,
                    severity_max: row.get(6)?,
                })
            })
            .map_err(|e| format!("query hatası: {e}"))?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    })
    .await
    .map_err(|e| format!("join hatası: {e}"))?
}

/// Sprint 9 G full — geçmiş tarama detayını çek. Read-only, side-effect yok.
#[tauri::command]
pub async fn list_scan_findings(
    db: State<'_, HistoryDb>,
    scan_id: i64,
) -> Result<Vec<ScanFindingDetail>, String> {
    let conn = db.conn.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<ScanFindingDetail>, String> {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = guard
            .prepare(
                "SELECT id, code, category, severity, params_json, created_at
                 FROM scan_findings WHERE scan_id = ?1 ORDER BY id ASC",
            )
            .map_err(|e| format!("prepare hatası: {e}"))?;
        let rows = stmt
            .query_map([scan_id], |row| {
                Ok(ScanFindingDetail {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    category: row.get(2)?,
                    severity: row.get(3)?,
                    params_json: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| format!("query hatası: {e}"))?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    })
    .await
    .map_err(|e| format!("join hatası: {e}"))?
}

/// Sprint 10 T — bir finding code'unun son N gündeki günlük sayısı.
///
/// PII-safe: SELECT-only, prepared statement, scan_findings.params_json'a dokunmaz.
/// `code` whitelist regex `^finding\.[a-z_]+\.[a-z_]+\.[a-z_]+$` ile validate edilir,
/// `days` 1..=90 clamp.
#[tauri::command]
pub async fn scan_findings_trend(
    db: State<'_, HistoryDb>,
    code: String,
    days: u32,
) -> Result<Vec<DateCount>, String> {
    use once_cell::sync::Lazy;
    use regex::Regex;
    static CODE_RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"^finding\.[a-z_]+\.[a-z_]+\.[a-z_]+$").unwrap());
    if !CODE_RE.is_match(&code) {
        return Err(format!("Geçersiz finding code: {code}"));
    }
    let days = days.clamp(1, 90);
    let conn = db.conn.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<DateCount>, String> {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = guard
            .prepare(
                "SELECT date(created_at) AS d, COUNT(*) AS c
                 FROM scan_findings
                 WHERE code = ?1
                   AND created_at >= datetime('now', '-' || ?2 || ' days')
                 GROUP BY d ORDER BY d ASC",
            )
            .map_err(|e| format!("prepare hatası: {e}"))?;
        let rows = stmt
            .query_map(rusqlite::params![code, days], |row| {
                Ok(DateCount {
                    date: row.get(0)?,
                    count: row.get::<_, i64>(1)? as u32,
                })
            })
            .map_err(|e| format!("query hatası: {e}"))?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    })
    .await
    .map_err(|e| format!("join hatası: {e}"))?
}

/// Sprint 11 review H5 fix — batch trend: çoklu code'u tek sorguda topla, N+1 lazy fetch
/// önlenir. HistoryDialog drawer ve HistoryTrendTab tek istekte tüm sparkline verisini alır.
///
/// Result: `HashMap<code, Vec<DateCount>>` (eksik code'lar boş Vec).
#[tauri::command]
pub async fn scan_findings_trend_batch(
    db: State<'_, HistoryDb>,
    codes: Vec<String>,
    days: u32,
) -> Result<std::collections::HashMap<String, Vec<DateCount>>, String> {
    use once_cell::sync::Lazy;
    use regex::Regex;
    static CODE_RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"^finding\.[a-z_]+\.[a-z_]+\.[a-z_]+$").unwrap());
    // Whitelist + 100 cap
    if codes.len() > 100 {
        return Err("En fazla 100 code".into());
    }
    for c in &codes {
        if !CODE_RE.is_match(c) {
            return Err(format!("Geçersiz code: {c}"));
        }
    }
    let days = days.clamp(1, 90);
    if codes.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let conn = db.conn.clone();
    let codes_clone = codes.clone();
    tauri::async_runtime::spawn_blocking(
        move || -> Result<std::collections::HashMap<String, Vec<DateCount>>, String> {
            let guard = conn.lock().map_err(|e| e.to_string())?;
            // IN (?, ?, ...) build
            let placeholders = std::iter::repeat("?")
                .take(codes_clone.len())
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!(
                "SELECT code, date(created_at) AS d, COUNT(*) AS c
                 FROM scan_findings
                 WHERE code IN ({placeholders})
                   AND created_at >= datetime('now', '-' || ?{days_idx} || ' days')
                 GROUP BY code, d ORDER BY code, d ASC",
                days_idx = codes_clone.len() + 1
            );
            let mut stmt = guard
                .prepare(&sql)
                .map_err(|e| format!("prepare hatası: {e}"))?;
            // Bind params: codes + days
            let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
            for c in &codes_clone {
                params.push(c);
            }
            params.push(&days);
            let rows: Vec<(String, String, u32)> = stmt
                .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)? as u32,
                    ))
                })
                .map_err(|e| format!("query hatası: {e}"))?
                .filter_map(Result::ok)
                .collect();
            let mut out: std::collections::HashMap<String, Vec<DateCount>> =
                std::collections::HashMap::new();
            // Boş Vec ile her code'u initialize et
            for c in &codes_clone {
                out.entry(c.clone()).or_default();
            }
            for (code, date, count) in rows {
                out.entry(code).or_default().push(DateCount { date, count });
            }
            Ok(out)
        },
    )
    .await
    .map_err(|e| format!("join hatası: {e}"))?
}

#[tauri::command]
pub async fn clear_history(db: State<'_, HistoryDb>) -> Result<(), String> {
    let conn = db.conn.clone();
    // VACUUM Sprint 6'da kaldırıldı — dosya kilit süresi azalır,
    // Sprint 8'de Settings > Advanced > "Veritabanını sıkıştır" butonu.
    // scan_findings ON DELETE CASCADE ile scans satırıyla birlikte silinir.
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        guard
            .execute("DELETE FROM scans", [])
            .map_err(|e| format!("clear hatası: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join hatası: {e}"))?
}
