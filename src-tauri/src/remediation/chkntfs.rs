//! Sprint 8 — chkntfs.exe wrapper. autochk scheduling + cancel + query.
//!
//! Güvenlik (invariant #2-7):
//! - Hardcoded `C:\Windows\System32\chkntfs.exe`
//! - Argüman closed-set whitelist
//! - `/d` (system-wide reset) YASAK
//! - Volume validation `remediation/volume.rs` paylaşımı

use crate::remediation::volume::validate_volume;
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const CHKNTFS_EXE_PATH: &str = r"C:\Windows\System32\chkntfs.exe";
const TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChkntfsState {
    /// `chkdsk has been scheduled` / `kontrol edilmek üzere işaretlenmiş` / `dirty`
    Scheduled,
    /// `is not dirty` / `kirli değil`
    NotDirty,
    /// Output anlaşılamadı — fail-soft (banner yok).
    Unknown,
}

fn chkntfs_path() -> Result<std::path::PathBuf, String> {
    let p = std::path::PathBuf::from(CHKNTFS_EXE_PATH);
    if !p.exists() {
        return Err(format!("chkntfs.exe bulunamadı: {}", p.display()));
    }
    Ok(p)
}

fn run(args: &[&str]) -> Result<(i32, String), String> {
    let path = chkntfs_path()?;
    let mut cmd = Command::new(&path);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("chkntfs başlatılamadı: {e}"))?;

    // stdout + stderr'i ayrı thread'lerde drain et (powershell.rs ile aynı
    // pipe-buffer kilitlenmesi riskini önler — bkz. util/powershell.rs).
    use std::io::Read;
    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();
    let out_reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut s) = stdout_pipe {
            let _ = s.read_to_end(&mut buf);
        }
        buf
    });
    let err_reader = std::thread::spawn(move || {
        if let Some(mut s) = stderr_pipe {
            let mut sink = Vec::new();
            let _ = s.read_to_end(&mut sink);
        }
    });

    let status = child
        .wait_timeout(TIMEOUT)
        .map_err(|e| format!("chkntfs wait_timeout: {e}"))?;
    let status = match status {
        Some(s) => s,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = out_reader.join();
            let _ = err_reader.join();
            return Err("chkntfs zaman aşımına uğradı".into());
        }
    };
    let stdout = out_reader.join().unwrap_or_default();
    let _ = err_reader.join();
    let text = String::from_utf8_lossy(&stdout).into_owned();
    Ok((status.code().unwrap_or(-1), text))
}

/// `chkntfs /c V:` — autochk'ı next boot'a planla. Idempotent.
pub fn schedule(volume: &str) -> Result<(), String> {
    let v = validate_volume(volume)?;
    let target = format!("{v}:");
    let (code, _out) = run(&["/c", &target])?;
    if code != 0 {
        return Err(format!("chkntfs /c başarısız (exit {code})"));
    }
    Ok(())
}

/// `chkntfs /x V:` — V'yi autochk exclude listesine al (mevcut schedule iptal).
/// SADECE bu volume'ü exclude eder; `/d` (system-wide reset) ASLA kullanılmaz.
pub fn cancel(volume: &str) -> Result<(), String> {
    let v = validate_volume(volume)?;
    let target = format!("{v}:");
    let (code, _out) = run(&["/x", &target])?;
    if code != 0 {
        return Err(format!("chkntfs /x başarısız (exit {code})"));
    }
    Ok(())
}

/// `chkntfs V:` — query state.
pub fn query(volume: &str) -> Result<ChkntfsState, String> {
    let v = validate_volume(volume)?;
    let target = format!("{v}:");
    let (_code, out) = run(&[&target])?;
    Ok(parse_query(&out))
}

/// TR + EN locale-agnostic substring match (invariant: parse fail-soft).
pub fn parse_query(out: &str) -> ChkntfsState {
    let lower = out.to_lowercase();
    // Scheduled
    if lower.contains("chkdsk has been scheduled")
        || lower.contains("will be checked at next reboot")
        || lower.contains("kontrol edilmek üzere işaretlenmiş")
        || lower.contains("kontrol edilmek üzere isaretlenmis")
        || lower.contains("dirty")
        || lower.contains("kirli")
    {
        // "is not dirty" / "kirli değil" — bu Scheduled değildir
        if lower.contains("not dirty")
            || lower.contains("kirli değil")
            || lower.contains("kirli degil")
        {
            return ChkntfsState::NotDirty;
        }
        return ChkntfsState::Scheduled;
    }
    if lower.contains("not dirty") || lower.contains("kirli değil") || lower.contains("kirli degil")
    {
        return ChkntfsState::NotDirty;
    }
    ChkntfsState::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_en_scheduled() {
        assert_eq!(
            parse_query("Chkdsk has been scheduled manually to run on next reboot on volume C:."),
            ChkntfsState::Scheduled
        );
    }

    #[test]
    fn parse_en_clean() {
        assert_eq!(parse_query("C: is not dirty."), ChkntfsState::NotDirty);
    }

    #[test]
    fn parse_tr_scheduled() {
        assert_eq!(
            parse_query("C: kontrol edilmek üzere işaretlenmiş."),
            ChkntfsState::Scheduled
        );
    }

    #[test]
    fn parse_tr_clean() {
        assert_eq!(parse_query("C: kirli değil."), ChkntfsState::NotDirty);
    }

    #[test]
    fn parse_unknown_garbage() {
        assert_eq!(parse_query("???"), ChkntfsState::Unknown);
        assert_eq!(parse_query(""), ChkntfsState::Unknown);
    }
}
