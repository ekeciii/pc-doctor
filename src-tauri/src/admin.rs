//! Yönetici (admin) yetkisi tespiti ve yeniden başlatma.
//!
//! Dev modunda manifest gömülmediği için exe normal kullanıcı olarak başlar.
//! Sistem değiştirici komutlar (System Restore, sfc, DISM, korumalı Temp klasörü)
//! çalıştırılmadan önce `is_elevated()` ile kontrol edilir; false ise UI
//! `NeedsElevation` hatası alır ve "Yönetici olarak yeniden başlat" butonu sunar.

#[cfg(windows)]
pub fn is_elevated() -> bool {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut size: u32 = 0;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut std::ffi::c_void),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut size,
        )
        .is_ok();
        let _ = CloseHandle(token);
        ok && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

/// Kendisini `runas` fiiliyle yeniden başlatır (UAC penceresi çıkar).
/// Başarılı olursa **mevcut süreç sonlandırılmalıdır** — bu fonksiyon
/// sonlandırmayı yapmaz, çağıran taraf `AppHandle::exit(0)` çağırmalı.
#[cfg(windows)]
pub fn relaunch_as_admin() -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{w, PCWSTR};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_wide: Vec<u16> = exe
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let hinst = ShellExecuteW(
            None,
            w!("runas"),
            PCWSTR(exe_wide.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
        );
        // ShellExecuteW HINSTANCE değeri > 32 ise başarılı (eski Win32 sözleşmesi).
        let code = hinst.0 as isize;
        if code <= 32 {
            return Err(format!("ShellExecuteW failed (code={})", code));
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn relaunch_as_admin() -> Result<(), String> {
    Err("Not supported on this platform".into())
}

/// Komut katmanı için kullanılacak sentinel hata mesajı.
/// Frontend bu prefix'i görünce elevation banner'ı tetikler.
pub const NEEDS_ELEVATION: &str = "NeedsElevation";

/// Sprint 7 (C): System Restore noktası oluşturulamadı sentinel'i.
/// Format: `RestoreFailed: <orjinal hata>`. Frontend bunu görünce
/// "Geri yükleme noktası olmadan devam et" recovery banner'ı tetikler.
/// (Sprint 6 öncesi hardcoded TR substring match yerine locale-agnostic sentinel.)
pub const RESTORE_FAILED: &str = "RestoreFailed";

// === Sprint 8 sentinel'leri (chkdsk /f) ===

/// chkntfs schedule OK ama shutdown spawn fail + rollback başarısız → split-brain state.
/// Frontend persistent banner: "chkntfs /x V: çalıştır veya reboot ile tamamla".
pub const SCHEDULE_INCONSISTENT: &str = "ScheduleInconsistent";

/// Non-system /f volume kilitlenemedi (process aktif handle tutuyor).
/// Frontend modal: "Sonraki açılışta planla" veya "Açık dosyaları kapat ve tekrar dene".
pub const VOLUME_LOCKED: &str = "VolumeLocked";
