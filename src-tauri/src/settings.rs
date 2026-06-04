//! Persistent app settings — locale, theme, telemetry opt-in, history flags.
//!
//! Storage: `tauri-plugin-store` (debounced autosave, JSON file at
//! `%APPDATA%/com.egeyu.pcdoctor/settings.json`). In-memory state:
//! `Arc<RwLock<Settings>>` for lock-free scan() reads.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const STORE_KEY: &str = "settings";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default = "default_locale")]
    pub locale: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub telemetry_enabled: bool, // PRD invariant: default OFF
    #[serde(default = "default_true")]
    pub history_enabled: bool,
    #[serde(default = "default_retention_days")]
    pub history_retention_days: u32,
}

fn default_schema_version() -> u32 { 1 }
fn default_locale() -> String { "tr".into() }
fn default_theme() -> String { "auto".into() }
fn default_true() -> bool { true }
fn default_retention_days() -> u32 { 90 }

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: default_schema_version(),
            locale: default_locale(),
            theme: default_theme(),
            telemetry_enabled: false,
            history_enabled: true,
            history_retention_days: default_retention_days(),
        }
    }
}

#[derive(Clone)]
pub struct SettingsState {
    pub inner: Arc<RwLock<Settings>>,
}

impl SettingsState {
    pub fn new(settings: Settings) -> Self {
        Self {
            inner: Arc::new(RwLock::new(settings)),
        }
    }

    pub fn snapshot(&self) -> Settings {
        self.inner.read().expect("settings poisoned").clone()
    }
}

/// Setup hook: load existing settings from store, fall back to defaults.
pub fn load(app: &AppHandle) -> Settings {
    match app.store(STORE_FILE) {
        Ok(store) => store
            .get(STORE_KEY)
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Settings {
    state.snapshot()
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, SettingsState>,
    settings: Settings,
) -> Result<Settings, String> {
    // In-memory update first (scan() will see new value immediately)
    {
        let mut guard = state.inner.write().map_err(|e| e.to_string())?;
        *guard = settings.clone();
    }
    // Persist via store (debounced autosave handles disk write)
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(&settings).map_err(|e| e.to_string())?;
    store.set(STORE_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(settings)
}
