//! chkdsk.exe wrapper. Sprint 6: /scan; Sprint 8: /f (non-system live + system scheduled).
//!
//! Güvenlik invaryantları (Sprint 6+7+8):
//! - volume regex `^[A-Z]$` (paylaşılan: `remediation/volume.rs`)
//! - chkdsk.exe **hardcoded** `C:\Windows\System32\chkdsk.exe`
//! - argüman whitelist:
//!   - `/scan`: `["<V>:", "/scan"]`
//!   - `/f`:    `["<V>:", "/f"]`  (`/x` YASAK — force dismount)
//!
//! Lifecycle (Sprint 8 refactor):
//! - `CURRENT_SESSION: Mutex<Option<ChkdskSession>>` enum:
//!   - `LiveScan(Child)` — Sprint 6 /scan
//!   - `LiveFix(Child)` — Sprint 8 non-system /f
//!   - `ScheduledFix { volume, scheduled_at }` — Sprint 8 system /f (autochk plan)
//! - `cancel_session()` dispatch: child variantlar kill+wait (H1 invariant: guard drop
//!   before wait), scheduled variant `chkntfs::cancel + reboot::abort` chain.

use crate::models::{ChkdskFixResult, ChkdskProgress, ChkdskResult, ChkdskStatus};
use crate::remediation::{chkntfs, reboot, volume as vol_util};
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PROGRESS_EVENT: &str = "chkdsk-progress";
const COMPLETE_EVENT: &str = "chkdsk-complete";
const FIX_COMPLETE_EVENT: &str = "chkdsk-fix-complete";
const LOG_TAIL_LINES: usize = 30;
const MAX_DURATION: Duration = Duration::from_secs(4 * 60 * 60);
const CHKDSK_EXE_PATH: &str = r"C:\Windows\System32\chkdsk.exe";

/// Sprint 6 detect_stage regex — TR/EN locale safe.
static STAGE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:stage|a[şs]ama)\s*([1-5])").unwrap());
static PERCENT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?:%\s*(\d{1,3})|(\d{1,3})\s*%)").unwrap());

#[derive(Debug)]
pub enum ChkdskSession {
    LiveScan(Child),
    LiveFix(Child),
    ScheduledFix {
        volume: String,
        /// Sprint 10 Faz 4 M-batch: hâlâ kullanılmıyor ama persistent state için saklanır
        /// (kullanıcı app exit + reboot sonrası fetch ihtiyacı). Silmek yerine attribute ile
        /// dead_code uyarısını bastır.
        #[allow(dead_code)]
        scheduled_at: String,
    },
}

static CURRENT_SESSION: Lazy<Mutex<Option<ChkdskSession>>> = Lazy::new(|| Mutex::new(None));

fn is_running() -> bool {
    CURRENT_SESSION
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false)
}

fn put_session(s: ChkdskSession) {
    let mut guard = match CURRENT_SESSION.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    *guard = Some(s);
}

fn take_session() -> Option<ChkdskSession> {
    let mut guard = match CURRENT_SESSION.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    guard.take()
}

/// Tüm session türleri için unified cancel — kullanıcı initiated.
///
/// - `LiveScan` / `LiveFix`: child.kill() + wait() (H1 invariant: guard drop ÖNCE wait).
/// - `ScheduledFix`: `chkntfs /x V:` SONRA `shutdown /a` (invariant #11 — failure-safe sıra).
///
/// Sprint 12 review H1+H3+H5 fix — `(schedule_cleared, reboot_aborted, cancelled_volume)`:
/// `cancelled_volume = Some(volume)` yalnız ScheduledFix iptal edildiğinde, multi-volume
/// pending state'ten bu volume'ün spesifik `remove`'u için.
pub fn cancel_session() -> (bool, bool, Option<String>) {
    let session = take_session(); // guard drop edilir
    match session {
        Some(ChkdskSession::LiveScan(mut c)) | Some(ChkdskSession::LiveFix(mut c)) => {
            let _ = c.kill();
            let _ = c.wait();
            (false, false, None)
        }
        Some(ChkdskSession::ScheduledFix { volume, .. }) => {
            let schedule_cleared = chkntfs::cancel(&volume).is_ok();
            let reboot_aborted = reboot::abort_reboot().unwrap_or(false);
            (schedule_cleared, reboot_aborted, Some(volume))
        }
        None => (false, false, None),
    }
}

/// Sprint 9 review C1+C2 fix + Sprint 10 review H1+H7 fix — invariant #22 atomik:
/// App exit (RunEvent::Exit) hook'tan çağrılır. SADECE live child session'ı sonlandırır.
/// `ScheduledFix` variantı KORUNUR (kullanıcı bilinçli kararıydı; sonraki launch'ta banner sorar).
///
/// **TOCTOU race fix**: Sprint 9 implementasyonu `take_session() → match → put_session`
/// pattern'i kullanıyordu — take ve put arası Mutex serbest, bu sırada başka thread (UI Cancel
/// veya yeni `run_chkdsk_fix`) `CURRENT_SESSION`'a yazarsa: ya ScheduledFix kaybolur (yeni
/// session ezilir) ya da Live kill etmeden yeni ScheduledFix ezilir.
/// Bu fix: Mutex'i match boyunca TUTAR, ScheduledFix'e ASLA dokunmaz (take etmez).
///
/// Returns `true` eğer live child gerçekten öldürüldüyse — caller log için.
pub fn cancel_live_only() -> bool {
    let child_to_kill: Option<Child> = {
        let mut guard = match CURRENT_SESSION.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        // Sadece Live* variantını çıkar; ScheduledFix variantına HİÇ dokunma (take YOK).
        match guard.as_ref() {
            Some(ChkdskSession::LiveScan(_)) | Some(ChkdskSession::LiveFix(_)) => {
                // Şimdi take güvenli — variant hâlâ Live (lock altındayız).
                match guard.take() {
                    Some(ChkdskSession::LiveScan(c)) | Some(ChkdskSession::LiveFix(c)) => Some(c),
                    _ => unreachable!("variant değişti — Mutex broken?"),
                }
            }
            _ => None, // ScheduledFix veya None — dokunma
        }
        // guard burada drop edilir; kill+wait lock dışında (H1 invariant)
    };
    if let Some(mut c) = child_to_kill {
        let _ = c.kill();
        let _ = c.wait();
        true
    } else {
        false
    }
}

/// Sprint 13 — `cancel_scan` shim KALDIRILDI; caller'lar artık doğrudan `cancel_session()`
/// kullanır (tuple Option ile volume bilgisi alır, multi-volume aware).
/// App exit hook için `cancel_live_only` kullan.

// =====================================================
// Stream helper — run_scan ve run_nonsystem_fix paylaşır
// =====================================================
//
// Sprint 7 H1 invariant: Mutex'e DOKUNMAZ. Caller put_session/take_session yapar.

fn stream_chkdsk_output(
    app: &AppHandle,
    reader: BufReader<std::process::ChildStdout>,
    volume: &str,
    started: Instant,
) -> (VecDeque<String>, bool) {
    let mut tail: VecDeque<String> = VecDeque::with_capacity(LOG_TAIL_LINES * 2);
    let mut timed_out = false;
    for raw in reader.split(b'\r') {
        if started.elapsed() > MAX_DURATION {
            timed_out = true;
            break;
        }
        let bytes = match raw {
            Ok(b) => b,
            Err(_) => continue,
        };
        let line = match std::str::from_utf8(&bytes) {
            Ok(s) => s.trim().trim_matches('\u{0}').to_string(),
            Err(_) => {
                let s: String = bytes.iter().map(|b| *b as char).collect();
                s.trim().trim_matches('\u{0}').to_string()
            }
        };
        if line.is_empty() {
            continue;
        }
        if tail.len() >= LOG_TAIL_LINES {
            tail.pop_front();
        }
        tail.push_back(line.clone());
        let percent = parse_percent(&line);
        let stage = detect_stage(&line);
        let _ = app.emit(
            PROGRESS_EVENT,
            ChkdskProgress {
                volume: volume.to_string(),
                stage,
                percent,
                text: line,
            },
        );
    }
    (tail, timed_out)
}

fn spawn_chkdsk_child(args: &[&str]) -> Result<Child, String> {
    let path = chkdsk_path()?;
    let mut cmd = Command::new(&path);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.spawn().map_err(|e| format!("chkdsk başlatılamadı: {e}"))
}

// =====================================================
// /scan — Sprint 6 (interface unchanged)
// =====================================================

pub fn run_scan(app: AppHandle, volume: String) -> Result<ChkdskResult, String> {
    vol_util::validate_volume(&volume)?;
    if is_running() {
        return Err("Bir chkdsk taraması zaten çalışıyor".into());
    }
    let target = format!("{volume}:");
    let started = Instant::now();

    let mut child = spawn_chkdsk_child(&[target.as_str(), "/scan"])?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "chkdsk stdout alınamadı".to_string())?;
    put_session(ChkdskSession::LiveScan(child));

    let _ = app.emit(
        PROGRESS_EVENT,
        ChkdskProgress {
            volume: volume.clone(),
            stage: 0,
            percent: None,
            text: format!("chkdsk {volume}: /scan başlatıldı, ilk çıktı bekleniyor..."),
        },
    );

    let reader = BufReader::new(stdout);
    let (tail, timed_out) = stream_chkdsk_output(&app, reader, &volume, started);

    // Child'ı geri al (cancel etmediyse hâlâ orada) → wait
    let session = take_session();
    let (exit_code, cancelled) = match session {
        Some(ChkdskSession::LiveScan(mut c)) => {
            if timed_out {
                let _ = c.kill();
            }
            let st = c.wait().map_err(|e| format!("wait: {e}"))?;
            (st.code().unwrap_or(-1), false)
        }
        // Cancel başka thread'den geldi
        _ => (-1, true),
    };
    let status = if cancelled || timed_out {
        ChkdskStatus::Cancelled
    } else {
        map_exit_code_scan(exit_code)
    };
    let errors_found = matches!(status, ChkdskStatus::ErrorsFound);
    let log_tail = tail.into_iter().collect::<Vec<_>>().join("\n");
    let result = ChkdskResult {
        volume,
        exit_code,
        status,
        errors_found,
        duration_seconds: started.elapsed().as_secs(),
        log_tail,
    };
    let _ = app.emit(COMPLETE_EVENT, &result);
    Ok(result)
}

// =====================================================
// /f live (non-system) — Sprint 8
// =====================================================

pub fn run_nonsystem_fix(app: AppHandle, volume: String) -> Result<ChkdskFixResult, String> {
    vol_util::validate_volume(&volume)?;
    if vol_util::is_system_drive(&volume) {
        return Err("System drive için live /f desteklenmiyor — schedule_system_fix kullan.".into());
    }
    if is_running() {
        return Err("Bir chkdsk işlemi zaten çalışıyor".into());
    }
    let target = format!("{volume}:");
    let started = Instant::now();

    // /f ONLY — /x (force dismount) ASLA (invariant #5).
    let mut child = spawn_chkdsk_child(&[target.as_str(), "/f"])?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "chkdsk stdout alınamadı".to_string())?;
    put_session(ChkdskSession::LiveFix(child));

    let _ = app.emit(
        PROGRESS_EVENT,
        ChkdskProgress {
            volume: volume.clone(),
            stage: 0,
            percent: None,
            text: format!("chkdsk {volume}: /f başlatıldı, ilk çıktı bekleniyor..."),
        },
    );

    let reader = BufReader::new(stdout);
    let (tail, timed_out) = stream_chkdsk_output(&app, reader, &volume, started);

    let session = take_session();
    let (exit_code, cancelled) = match session {
        Some(ChkdskSession::LiveFix(mut c)) => {
            if timed_out {
                let _ = c.kill();
            }
            let st = c.wait().map_err(|e| format!("wait: {e}"))?;
            (st.code().unwrap_or(-1), false)
        }
        _ => (-1, true),
    };
    let status = if cancelled || timed_out {
        ChkdskStatus::Cancelled
    } else {
        map_exit_code_fix(exit_code)
    };
    let errors_found = matches!(status, ChkdskStatus::ErrorsFound);
    let log_tail = tail.into_iter().collect::<Vec<_>>().join("\n");

    let result = ChkdskFixResult {
        volume,
        mode: "live".to_string(),
        system_drive: false,
        status,
        exit_code,
        errors_found,
        duration_seconds: started.elapsed().as_secs(),
        log_tail,
        restore_point_created: false, // caller (commands.rs) doldurur
        restore_point_skipped_reason: None,
    };
    let _ = app.emit(FIX_COMPLETE_EVENT, &result);
    Ok(result)
}

// =====================================================
// System drive /f — schedule autochk (Sprint 8)
// =====================================================

/// `chkntfs /c V:` ile autochk planlar; session state `ScheduledFix` olur.
/// Reboot scheduling caller'da (commands.rs) yapılır — bu fonksiyon yalnız scheduling adımını atar.
pub fn schedule_system_fix(volume: String) -> Result<ChkdskFixResult, String> {
    vol_util::validate_volume(&volume)?;
    if !vol_util::is_system_drive(&volume) {
        return Err("schedule_system_fix yalnız system drive için (C:).".into());
    }
    if is_running() {
        return Err("Bir chkdsk işlemi zaten çalışıyor".into());
    }
    chkntfs::schedule(&volume)?;
    let scheduled_at = chrono::Utc::now().to_rfc3339();
    put_session(ChkdskSession::ScheduledFix {
        volume: volume.clone(),
        scheduled_at: scheduled_at.clone(),
    });
    Ok(ChkdskFixResult {
        volume,
        mode: "scheduled".to_string(),
        system_drive: true,
        status: ChkdskStatus::Scheduled,
        exit_code: 0,
        errors_found: false,
        duration_seconds: 0,
        log_tail: format!("autochk scheduled at {scheduled_at}"),
        restore_point_created: false,
        restore_point_skipped_reason: None,
    })
}

// =====================================================
// Helpers
// =====================================================

fn chkdsk_path() -> Result<std::path::PathBuf, String> {
    let path = std::path::PathBuf::from(CHKDSK_EXE_PATH);
    if !path.exists() {
        return Err(format!("chkdsk.exe bulunamadı: {}", path.display()));
    }
    Ok(path)
}

/// /scan exit code semantics
fn map_exit_code_scan(code: i32) -> ChkdskStatus {
    match code {
        0 => ChkdskStatus::Clean,
        1 | 2 => ChkdskStatus::ErrorsFound,
        _ => ChkdskStatus::ScanFailed,
    }
}

/// /f exit code semantics — 1 = "found+fixed" = Repaired
fn map_exit_code_fix(code: i32) -> ChkdskStatus {
    match code {
        0 => ChkdskStatus::Clean,
        1 => ChkdskStatus::Repaired,
        2 => ChkdskStatus::ErrorsFound, // partial — not repaired
        _ => ChkdskStatus::ScanFailed,
    }
}

fn parse_percent(line: &str) -> Option<u8> {
    let caps = PERCENT_RE.captures(line)?;
    let s = caps.get(1).or_else(|| caps.get(2))?.as_str();
    let n: u32 = s.parse().ok()?;
    if n > 100 {
        None
    } else {
        Some(n as u8)
    }
}

fn detect_stage(line: &str) -> u8 {
    if let Some(c) = STAGE_RE.captures(line) {
        return c[1].parse().unwrap_or(0);
    }
    let lower = line.to_lowercase();
    if lower.contains("dosya kayıtları") || lower.contains("file record") {
        1
    } else if lower.contains("indeks") || lower.contains("index") {
        2
    } else if lower.contains("güvenlik tanımlayıcı") || lower.contains("security descriptor") {
        3
    } else if lower.contains("usn") {
        4
    } else if lower.contains("free space") || lower.contains("boş alan") {
        5
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_percent_handles_both_locale_forms() {
        assert_eq!(parse_percent("50% tamamlandı"), Some(50));
        assert_eq!(parse_percent("%50 tamamlandı"), Some(50));
        assert_eq!(parse_percent("Stage 4 (100%)"), Some(100));
        assert_eq!(parse_percent("% 7"), Some(7));
        assert_eq!(parse_percent("noisy line no pct"), None);
        assert_eq!(parse_percent("999%"), None);
    }

    #[test]
    fn detect_stage_handles_tr_and_en() {
        assert_eq!(detect_stage("Stage 1: Examining file records..."), 1);
        assert_eq!(detect_stage("Aşama 2: Indeksler doğrulanıyor"), 2);
        assert_eq!(detect_stage("aşama 3: güvenlik tanımlayıcılar"), 3);
        assert_eq!(detect_stage("asama 4 (ASCII katlama)"), 4);
        assert_eq!(detect_stage("Stage 5"), 5);
        assert_eq!(detect_stage("File record segments verified"), 1);
        assert_eq!(detect_stage("Belirsiz log satırı"), 0);
    }

    #[test]
    fn scan_exit_code_semantics() {
        assert_eq!(map_exit_code_scan(0), ChkdskStatus::Clean);
        assert_eq!(map_exit_code_scan(1), ChkdskStatus::ErrorsFound);
        assert_eq!(map_exit_code_scan(2), ChkdskStatus::ErrorsFound);
        assert_eq!(map_exit_code_scan(3), ChkdskStatus::ScanFailed);
        assert_eq!(map_exit_code_scan(-1), ChkdskStatus::ScanFailed);
    }

    #[test]
    fn fix_exit_code_distinguishes_repaired() {
        assert_eq!(map_exit_code_fix(0), ChkdskStatus::Clean);
        assert_eq!(map_exit_code_fix(1), ChkdskStatus::Repaired);
        assert_eq!(map_exit_code_fix(2), ChkdskStatus::ErrorsFound);
        assert_eq!(map_exit_code_fix(3), ChkdskStatus::ScanFailed);
    }
}
