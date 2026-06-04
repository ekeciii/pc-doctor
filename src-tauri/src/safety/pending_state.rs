//! Sprint 8 — `pending_chkdsk.json` persistence.
//! Sprint 11 H6 — v1 (tek obje) → v2 (Vec<PendingChkdsk>) migration shim.
//!
//! Settings'ten AYRI dosya (invariant #17): settings export'a sızmaz.
//! Ground-truth: chkntfs query. JSON yalnız OPTIMISTIC HINT.
//!
//! Migration shim: v1 verisi sessizce v2'ye wrap edilir; veri kaybı YASAK (security_invariants).

use crate::models::PendingChkdsk;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "pending_chkdsk.json";
const SCHEMA_VERSION: u32 = 2;

/// Sprint 11 H6 — v2 wrapper. v1 (tek obje) migration shim ile geriye uyumlu.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingChkdskState {
    pub version: u32,
    pub volumes: Vec<PendingChkdsk>,
}

impl PendingChkdskState {
    pub fn new(volumes: Vec<PendingChkdsk>) -> Self {
        Self {
            version: SCHEMA_VERSION,
            volumes,
        }
    }
}

fn path_for(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("dir create: {e}"))?;
    Ok(dir.join(FILE_NAME))
}

/// Parse v1 veya v2 — migration shim. v1 (tek obje) wrap edilip Vec yapılır.
fn parse_any(raw: &str) -> Option<PendingChkdskState> {
    // Önce v2 dene
    if let Ok(state) = serde_json::from_str::<PendingChkdskState>(raw) {
        return Some(state);
    }
    // v1 fallback (tek PendingChkdsk obje)
    if let Ok(single) = serde_json::from_str::<PendingChkdsk>(raw) {
        return Some(PendingChkdskState::new(vec![single]));
    }
    None
}

/// Sprint 8 legacy API — yalnız ilk volume'ü döner (backward compat).
pub fn read(app: &AppHandle) -> Option<PendingChkdsk> {
    read_all(app)?.volumes.into_iter().next()
}

/// Sprint 11 H6 — tüm pending volume listesi (multi-volume aware).
pub fn read_all(app: &AppHandle) -> Option<PendingChkdskState> {
    let p = path_for(app).ok()?;
    if !p.exists() {
        return None;
    }
    let raw = std::fs::read_to_string(&p).ok()?;
    parse_any(&raw)
}

/// Sprint 8 legacy API — tek volume yazar (mevcut listeyi EZER).
/// Sprint 11+ caller'lar `write_all` veya `append` kullansın.
pub fn write(app: &AppHandle, state: &PendingChkdsk) -> Result<(), String> {
    write_all(app, &PendingChkdskState::new(vec![state.clone()]))
}

pub fn write_all(app: &AppHandle, state: &PendingChkdskState) -> Result<(), String> {
    let p = path_for(app)?;
    let raw = serde_json::to_string_pretty(state)
        .map_err(|e| format!("serialize: {e}"))?;
    std::fs::write(&p, raw).map_err(|e| format!("write: {e}"))
}

/// Sprint 11 H6 + Sprint 12 review H2 fix — listeye ekle (mevcut listeyi korur).
/// Corrupt JSON durumunda dosya `.corrupt-<ts>` ile rename edilir; veri kaybı engellenir,
/// forensik kopya korunur.
pub fn append(app: &AppHandle, item: PendingChkdsk) -> Result<(), String> {
    let p = path_for(app)?;
    let existing_state = if p.exists() {
        let raw = std::fs::read_to_string(&p).map_err(|e| format!("read: {e}"))?;
        match parse_any(&raw) {
            Some(s) => s,
            None => {
                // Corrupt — kopyaya rename et, yeni durum başlat (veri kaybı önleme)
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let bak = p.with_extension(format!("json.corrupt-{ts}"));
                let _ = std::fs::rename(&p, &bak);
                eprintln!(
                    "[pending_state] corrupt JSON — backed up to {} and starting fresh",
                    bak.display()
                );
                PendingChkdskState::new(Vec::new())
            }
        }
    } else {
        PendingChkdskState::new(Vec::new())
    };
    let mut state = existing_state;
    state.volumes.retain(|v| v.volume != item.volume);
    state.volumes.push(item);
    state.version = SCHEMA_VERSION;
    write_all(app, &state)
}

/// Sprint 11 H6 — bir volume'ü listeden çıkar. Liste boşalırsa dosya silinir.
pub fn remove(app: &AppHandle, volume: &str) -> Result<(), String> {
    let mut state = match read_all(app) {
        Some(s) => s,
        None => return Ok(()),
    };
    state.volumes.retain(|v| v.volume != volume);
    if state.volumes.is_empty() {
        clear(app)
    } else {
        write_all(app, &state)
    }
}

pub fn clear(app: &AppHandle) -> Result<(), String> {
    let p = path_for(app)?;
    if p.exists() {
        std::fs::remove_file(&p).map_err(|e| format!("remove: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::PendingChkdsk;

    #[test]
    fn pending_serializes_camelcase() {
        let p = PendingChkdsk {
            volume: "C".into(),
            scheduled_at: "2026-06-02T10:00:00Z".into(),
            reboot_pending: true,
        };
        let s = serde_json::to_string(&p).unwrap();
        assert!(s.contains("\"scheduledAt\""));
        assert!(s.contains("\"rebootPending\""));
    }

    #[test]
    fn pending_deserializes_back() {
        let raw = r#"{"volume":"D","scheduledAt":"2026-06-02T10:00:00Z","rebootPending":false}"#;
        let p: PendingChkdsk = serde_json::from_str(raw).unwrap();
        assert_eq!(p.volume, "D");
        assert!(!p.reboot_pending);
    }

    #[test]
    fn corrupt_json_returns_none() {
        let bad: Result<PendingChkdsk, _> = serde_json::from_str("not json");
        assert!(bad.is_err());
    }

    // === Sprint 11 H6 migration tests ===

    #[test]
    fn migration_v1_single_obj_to_v2_vec() {
        // v1 format: tek PendingChkdsk obje, no version field
        let v1_raw = r#"{"volume":"C","scheduledAt":"2026-06-02T10:00:00Z","rebootPending":false}"#;
        let state = parse_any(v1_raw).expect("v1 migrate edilmeli");
        assert_eq!(state.version, SCHEMA_VERSION);
        assert_eq!(state.volumes.len(), 1);
        assert_eq!(state.volumes[0].volume, "C");
    }

    #[test]
    fn migration_v2_native_parses_directly() {
        let v2_raw = r#"{"version":2,"volumes":[{"volume":"C","scheduledAt":"x","rebootPending":false},{"volume":"D","scheduledAt":"y","rebootPending":false}]}"#;
        let state = parse_any(v2_raw).expect("v2 parse");
        assert_eq!(state.version, 2);
        assert_eq!(state.volumes.len(), 2);
        assert_eq!(state.volumes[0].volume, "C");
        assert_eq!(state.volumes[1].volume, "D");
    }

    #[test]
    fn migration_corrupt_returns_none() {
        let bad = parse_any("not json").is_none();
        assert!(bad);
    }

    #[test]
    fn migration_v1_volume_preserved_no_data_loss() {
        // SECURITY INVARIANT: v1 verisi v2'ye migrate edilirken volume KAYBI YASAK
        let v1_raw = r#"{"volume":"D","scheduledAt":"2026-06-02T10:00:00Z","rebootPending":true}"#;
        let state = parse_any(v1_raw).expect("v1 migrate");
        assert_eq!(state.volumes[0].volume, "D", "v1 volume KORUNMALI");
        assert_eq!(state.volumes[0].scheduled_at, "2026-06-02T10:00:00Z");
        assert!(state.volumes[0].reboot_pending);
    }
}
