//! Sprint 8 — shutdown.exe wrapper. Reboot scheduling + abort.
//! Sprint 9 J — RebootScheduler trait + MockRebootScheduler test infra.
//!
//! Güvenlik (invariant #2-7):
//! - Hardcoded `C:\Windows\System32\shutdown.exe`
//! - `/t` clamp `60..=600`
//! - `/c` mesaj SABIT ASCII const (injection prevention)
//! - `/r /t N /c MSG /d p:4:1` exact arg list

use once_cell::sync::Lazy;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const SHUTDOWN_EXE_PATH: &str = r"C:\Windows\System32\shutdown.exe";
/// SABIT mesaj — kullanıcı input interpolasyon YASAK.
pub const SHUTDOWN_MESSAGE: &str =
    "PC Doctor: chkdsk /f icin yeniden baslatiliyor - acik dosyalarinizi kaydedin.";
pub const MIN_SECONDS: u32 = 60;
pub const MAX_SECONDS: u32 = 600;

/// Countdown sırasında shutdown.exe child handle'ı tutulur — RunEvent::Exit hook'unda
/// kill edilir. Sprint 7 H1 invariant: lock SADECE take/insert için tutulur.
pub static SHUTDOWN_CHILD: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

// =====================================================
// Sprint 9 J — RebootScheduler trait + Mock
// =====================================================

/// Test edilebilirlik için abstraction. Production: `WindowsRebootScheduler`.
/// CI/test: `MockRebootScheduler` (no-op + call log).
pub trait RebootScheduler {
    fn schedule(&self, seconds: u32) -> Result<u32, String>;
    fn abort(&self) -> Result<bool, String>;
}

/// Üretim impl — gerçek shutdown.exe spawn eder.
pub struct WindowsRebootScheduler;

impl RebootScheduler for WindowsRebootScheduler {
    fn schedule(&self, seconds: u32) -> Result<u32, String> {
        schedule_reboot(seconds)?;
        Ok(seconds.clamp(MIN_SECONDS, MAX_SECONDS))
    }

    fn abort(&self) -> Result<bool, String> {
        abort_reboot()
    }
}

/// Test-only impl — gerçekten reboot ETMEZ; clamp ve abort idempotency'i test etmek için.
/// `schedule_calls` ve `abort_calls` her çağrıyı sayar.
#[cfg(any(test, feature = "reboot-mock"))]
pub struct MockRebootScheduler {
    pub schedule_calls: std::sync::Mutex<Vec<u32>>,
    pub abort_calls: std::sync::Mutex<u32>,
    pub pending: std::sync::Mutex<bool>,
}

#[cfg(any(test, feature = "reboot-mock"))]
impl MockRebootScheduler {
    pub fn new() -> Self {
        Self {
            schedule_calls: std::sync::Mutex::new(Vec::new()),
            abort_calls: std::sync::Mutex::new(0),
            pending: std::sync::Mutex::new(false),
        }
    }
}

#[cfg(any(test, feature = "reboot-mock"))]
impl Default for MockRebootScheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(any(test, feature = "reboot-mock"))]
impl RebootScheduler for MockRebootScheduler {
    fn schedule(&self, seconds: u32) -> Result<u32, String> {
        let clamped = seconds.clamp(MIN_SECONDS, MAX_SECONDS);
        self.schedule_calls.lock().unwrap().push(clamped);
        *self.pending.lock().unwrap() = true;
        Ok(clamped)
    }

    fn abort(&self) -> Result<bool, String> {
        let mut calls = self.abort_calls.lock().unwrap();
        *calls += 1;
        let mut pending = self.pending.lock().unwrap();
        let was_pending = *pending;
        *pending = false;
        // 1116 semantic: idempotent — false döner ama Ok
        Ok(was_pending)
    }
}

// =====================================================
// Concrete Windows impl
// =====================================================

fn shutdown_path() -> Result<std::path::PathBuf, String> {
    let p = std::path::PathBuf::from(SHUTDOWN_EXE_PATH);
    if !p.exists() {
        return Err(format!("shutdown.exe bulunamadı: {}", p.display()));
    }
    Ok(p)
}

/// `shutdown /r /t N /c MSG /d p:4:1` — N is clamped to [60, 600].
pub fn schedule_reboot(seconds: u32) -> Result<(), String> {
    let t = seconds.clamp(MIN_SECONDS, MAX_SECONDS);
    let path = shutdown_path()?;
    let t_str = t.to_string();
    let args: &[&str] = &[
        "/r",
        "/t",
        &t_str,
        "/c",
        SHUTDOWN_MESSAGE,
        "/d",
        "p:4:1",
    ];

    let mut cmd = Command::new(&path);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let child = cmd
        .spawn()
        .map_err(|e| format!("shutdown başlatılamadı: {e}"))?;
    {
        let mut guard = match SHUTDOWN_CHILD.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if let Some(mut prev) = guard.take() {
            let _ = prev.kill();
            let _ = prev.wait();
        }
        *guard = Some(child);
    }
    Ok(())
}

pub fn abort_reboot() -> Result<bool, String> {
    let prev_child = {
        let mut guard = match SHUTDOWN_CHILD.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.take()
    };
    if let Some(mut c) = prev_child {
        let _ = c.kill();
        let _ = c.wait();
    }

    let path = shutdown_path()?;
    let mut cmd = Command::new(&path);
    cmd.args(["/a"]).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("shutdown /a başlatılamadı: {e}"))?;
    let status = child
        .wait()
        .map_err(|e| format!("shutdown /a wait: {e}"))?;
    match status.code() {
        Some(0) => Ok(true),
        Some(1116) => Ok(false),
        Some(code) => Err(format!("shutdown /a exit {code}")),
        None => Err("shutdown /a signal".into()),
    }
}

pub fn kill_pending_reboot_countdown() -> bool {
    let prev = {
        let mut guard = match SHUTDOWN_CHILD.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.take()
    };
    if let Some(mut c) = prev {
        let _ = c.kill();
        let _ = c.wait();
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_min_max() {
        assert_eq!(0_u32.clamp(MIN_SECONDS, MAX_SECONDS), MIN_SECONDS);
        assert_eq!(5_u32.clamp(MIN_SECONDS, MAX_SECONDS), MIN_SECONDS);
        assert_eq!(60_u32.clamp(MIN_SECONDS, MAX_SECONDS), 60);
        assert_eq!(120_u32.clamp(MIN_SECONDS, MAX_SECONDS), 120);
        assert_eq!(600_u32.clamp(MIN_SECONDS, MAX_SECONDS), 600);
        assert_eq!(9999_u32.clamp(MIN_SECONDS, MAX_SECONDS), MAX_SECONDS);
    }

    #[test]
    fn message_is_ascii_const() {
        assert!(SHUTDOWN_MESSAGE.is_ascii());
        assert!(!SHUTDOWN_MESSAGE.contains('{'));
    }

    // =====================================================
    // Sprint 9 J — RebootScheduler trait tests via Mock
    // =====================================================

    #[test]
    fn mock_schedule_clamps_input() {
        let m = MockRebootScheduler::new();
        assert_eq!(m.schedule(0).unwrap(), MIN_SECONDS);
        assert_eq!(m.schedule(30).unwrap(), MIN_SECONDS);
        assert_eq!(m.schedule(120).unwrap(), 120);
        assert_eq!(m.schedule(9999).unwrap(), MAX_SECONDS);
        let calls = m.schedule_calls.lock().unwrap();
        assert_eq!(*calls, vec![MIN_SECONDS, MIN_SECONDS, 120, MAX_SECONDS]);
    }

    #[test]
    fn mock_abort_idempotent() {
        let m = MockRebootScheduler::new();
        // First abort with no pending — 1116 semantic = false but Ok
        assert_eq!(m.abort().unwrap(), false);
        m.schedule(120).unwrap();
        assert_eq!(m.abort().unwrap(), true);
        // Idempotent — second abort on no-pending is OK
        assert_eq!(m.abort().unwrap(), false);
        assert_eq!(*m.abort_calls.lock().unwrap(), 3);
    }

    #[test]
    fn mock_pending_state_transitions() {
        let m = MockRebootScheduler::new();
        assert!(!*m.pending.lock().unwrap());
        m.schedule(120).unwrap();
        assert!(*m.pending.lock().unwrap());
        m.abort().unwrap();
        assert!(!*m.pending.lock().unwrap());
    }

    #[test]
    fn windows_scheduler_implements_trait() {
        // Compile-time check that WindowsRebootScheduler implements RebootScheduler.
        fn assert_impl<T: RebootScheduler>(_: &T) {}
        let w = WindowsRebootScheduler;
        assert_impl(&w);
    }
}
