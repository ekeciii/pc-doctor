//! Scan history retention enforcement.
//!
//! - Birincil tetikleyici: `record_scan` INSERT öncesi
//! - Yedek tetikleyici: `setup()` startup — kullanıcı uygulamayı uzun süre açmazsa da uygulanır
//! - Defense-in-depth: days clamp(1, 3650)
//! - SQL: `DELETE FROM scans WHERE started_at < cutoff_iso` — `idx_scans_started_at` index'i zaten var

use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

pub fn enforce(conn: &Connection, retention_days: u32) -> rusqlite::Result<usize> {
    let days = retention_days.clamp(1, 3650) as i64;
    let cutoff = Utc::now() - Duration::days(days);
    let cutoff_iso = cutoff.to_rfc3339();

    let deleted = conn.execute(
        "DELETE FROM scans WHERE started_at < ?1",
        params![cutoff_iso],
    )?;

    if deleted > 0 {
        eprintln!(
            "[history] retention enforced: {} satır silindi (retention: {} gün)",
            deleted, days
        );
    }
    Ok(deleted)
}
