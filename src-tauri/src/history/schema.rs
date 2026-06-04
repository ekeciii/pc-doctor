//! Manual `PRAGMA user_version` migration ladder.
//!
//! v1: scans tablosu (yalnız özet sayım).
//! v2: scan_findings tablosu (Sprint 7 G partial) — finding kodları + whitelisted params_json.
//!     PII invaryantı: params_json yalnız categori-özel whitelist anahtarlar içerir,
//!     yol/`%USERPROFILE%` normalize, event log mesaji ASLA yazılmaz (sadece event_id).

use rusqlite::Connection;

pub const SCHEMA_VERSION: u32 = 2;

pub fn migrate(conn: &Connection) -> Result<(), String> {
    let current: u32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))
        .map_err(|e| format!("user_version okunamadı: {e}"))?;

    if current >= SCHEMA_VERSION {
        return Ok(());
    }

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("tx başlatılamadı: {e}"))?;

    if current < 1 {
        tx.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL,
                finding_count INTEGER NOT NULL,
                critical_count INTEGER NOT NULL,
                warning_count INTEGER NOT NULL,
                severity_max TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_scans_started_at ON scans(started_at);
            "#,
        )
        .map_err(|e| format!("v0→v1 schema oluşturulamadı: {e}"))?;
    }

    if current < 2 {
        // Sprint 7 G partial: finding-level persistence. UI Sprint 8'e ertelendi
        // (HistoryDialog detail expand). PII whitelist + path normalize Backend
        // tarafında `diagnostics/util::sanitize_params` ile uygulanır.
        tx.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS scan_findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
                code TEXT NOT NULL,
                category TEXT NOT NULL,
                severity TEXT NOT NULL,
                params_json TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_scan_findings_scan ON scan_findings(scan_id);
            CREATE INDEX IF NOT EXISTS idx_scan_findings_code ON scan_findings(code);
            "#,
        )
        .map_err(|e| format!("v1→v2 schema oluşturulamadı: {e}"))?;
    }

    tx.execute(&format!("PRAGMA user_version = {SCHEMA_VERSION}"), [])
        .map_err(|e| format!("user_version set edilemedi: {e}"))?;

    tx.commit().map_err(|e| format!("commit hatası: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_memory() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn
    }

    #[test]
    fn migrate_from_fresh_is_v2() {
        let conn = open_memory();
        migrate(&conn).expect("migrate fresh");
        let v: u32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, SCHEMA_VERSION);
        // scan_findings exists
        conn.prepare("SELECT COUNT(*) FROM scan_findings")
            .expect("scan_findings table missing");
    }

    #[test]
    fn migrate_is_idempotent() {
        let conn = open_memory();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        let v: u32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, SCHEMA_VERSION);
    }

    #[test]
    fn migrate_v1_to_v2_preserves_scans() {
        let conn = open_memory();
        // Simulate a v1 install
        conn.execute_batch(
            r#"
            CREATE TABLE scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL,
                finding_count INTEGER NOT NULL,
                critical_count INTEGER NOT NULL,
                warning_count INTEGER NOT NULL,
                severity_max TEXT NOT NULL
            );
            INSERT INTO scans (started_at, finished_at, finding_count, critical_count, warning_count, severity_max)
                VALUES ('2026-06-01T00:00:00Z', '2026-06-01T00:00:05Z', 3, 1, 1, 'critical');
            PRAGMA user_version = 1;
            "#,
        )
        .unwrap();

        migrate(&conn).expect("migrate v1→v2");
        let count: u32 = conn
            .query_row("SELECT COUNT(*) FROM scans", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "v1 row should survive migration");

        // scan_findings is empty but exists
        let fc: u32 = conn
            .query_row("SELECT COUNT(*) FROM scan_findings", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fc, 0);
    }
}
