//! Ortak PowerShell sarmalayıcısı.
//!
//! - Çıktıyı UTF-8 olarak zorlar (`[Console]::OutputEncoding` + `$OutputEncoding`)
//!   böylece Türkçe karakterler (İ, Ş, Ğ, Ç, Ö, Ü) kaybolmaz.
//! - UTF-8 dekoder lossy — geçersiz byte tüm sonucu atmaz.
//! - Timeout uygular — hung Get-NetFirewallProfile/Get-BitLockerVolume tüm taramayı dondurmaz.

use std::io::Read;
use std::process::{Command, Stdio};
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Hızlı registry / basit WMI sorguları için (~5 s timeout).
pub fn run_fast(script: &str) -> Option<String> {
    run_with_timeout(script, Duration::from_secs(5))
}

/// Normal CIM/WMI sorguları için (~10 s timeout).
pub fn run_cim(script: &str) -> Option<String> {
    run_with_timeout(script, Duration::from_secs(10))
}

/// Get-Counter / sample collection için (~12 s timeout, 3 s sample + jitter).
pub fn run_counter(script: &str) -> Option<String> {
    run_with_timeout(script, Duration::from_secs(12))
}

pub fn run_with_timeout(script: &str, timeout: Duration) -> Option<String> {
    let preamble = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
                    $OutputEncoding = [System.Text.Encoding]::UTF8; \
                    $ErrorActionPreference = 'SilentlyContinue'; ";
    let full = format!("{preamble}{script}");

    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &full])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().ok()?;

    // ÖNEMLİ: stdout'u AYRI bir thread'de drain et. Aksi halde script'in çıktısı
    // OS pipe buffer'ını (~4-64 KB) aşarsa child yazarken bloklanır, asla bitmez,
    // timeout tetiklenir ve TÜM çıktı kaybolur. Reader thread pipe'ı `wait` ile
    // eşzamanlı boşalttığı için bu kilitlenme oluşmaz.
    let stdout = child.stdout.take()?;
    let reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let mut stdout = stdout;
        let _ = stdout.read_to_end(&mut buf);
        buf
    });

    use wait_timeout::ChildExt;
    let status_opt = child.wait_timeout(timeout).ok()?;
    match status_opt {
        Some(status) => {
            // Process bitti; reader thread'in pipe'ı tamamen okumasını bekle.
            let buf = reader.join().unwrap_or_default();
            if !status.success() {
                return None;
            }
            Some(String::from_utf8_lossy(&buf).into_owned())
        }
        None => {
            // Timeout → child'ı öldür ve reap et. kill() pipe'ı kapatır, böylece
            // reader thread EOF görüp sonlanır (join'i askıda bırakmaz).
            let _ = child.kill();
            let _ = child.wait();
            let _ = reader.join();
            None
        }
    }
}
