//! Scan history persistence — SQLite via rusqlite.
//!
//! Schema lives in `schema.rs`, commands in `commands.rs`. Path:
//! `%APPDATA%/com.egeyu.pcdoctor/history.db`. PRAGMAs: WAL + NORMAL + FK + busy_timeout.
//!
//! PII invariant: scans table holds only id/timestamps/counts/severity.
//! No file paths, hostnames, usernames, or finding bodies.

pub mod commands;
pub mod retention;
pub mod schema;

use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct HistoryDb {
    pub conn: Arc<Mutex<Connection>>,
}

impl HistoryDb {
    fn from_connection(conn: Connection) -> Self {
        Self {
            conn: Arc::new(Mutex::new(conn)),
        }
    }
}

pub fn init(app: &AppHandle) -> Result<HistoryDb, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir alınamadı: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("data dir oluşturulamadı: {e}"))?;
    let db_path = dir.join("history.db");
    let conn = open_connection(&db_path)?;
    schema::migrate(&conn)?;
    Ok(HistoryDb::from_connection(conn))
}

fn open_connection(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("DB açılamadı: {e}"))?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )
    .map_err(|e| format!("PRAGMA set edilemedi: {e}"))?;
    Ok(conn)
}
