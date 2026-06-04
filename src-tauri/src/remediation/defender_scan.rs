//! Defender Hızlı Tarama (Start-MpScan -ScanType QuickScan).
//!
//! Start-MpScan synchronous bloklar; sfc'den farklı olarak streaming output vermez.
//! UI'da spinner gösterilir, bitince sonuç döner.

use crate::collectors::defender::collect_recent_threats;
use crate::models::DefenderScanResult;
use std::process::Command;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const START_EVENT: &str = "defender-scan-start";
const COMPLETE_EVENT: &str = "defender-scan-complete";

pub fn run(app: AppHandle) -> Result<DefenderScanResult, String> {
    let _ = app.emit(START_EVENT, ());
    let started = Instant::now();

    let mut cmd = Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Start-MpScan -ScanType QuickScan -ErrorAction Stop",
    ]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Start-MpScan başlatılamadı: {}", e))?;
    let duration_seconds = started.elapsed().as_secs();

    let scan_ok = output.status.success();
    let error = if scan_ok {
        None
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Some(if stderr.is_empty() {
            format!("Tarama başarısız (exit {})", output.status.code().unwrap_or(-1))
        } else {
            stderr
        })
    };

    let threats_found = collect_recent_threats();

    let result = DefenderScanResult {
        scan_ok,
        duration_seconds,
        threats_found,
        error,
    };
    let _ = app.emit(COMPLETE_EVENT, &result);
    Ok(result)
}
