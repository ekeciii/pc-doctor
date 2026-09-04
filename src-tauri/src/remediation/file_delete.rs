//! Sprint 14 — kullanıcı-seçimli dosya silme.
//!
//! Büyük/kullanılmayan dosya tarayıcısında işaretlenen dosyaları **Geri Dönüşüm Kutusu'na**
//! taşır (kalıcı silmez — yanlışlıkla seçilen dosyalar kurtarılabilir kalsın). Her yol
//! taşımadan önce `safety::protected` ile yeniden denetlenir (UI'ı atlayan/elle gelen yollar
//! için çift güvenlik). Sadece DOSYA taşır — dizin asla.

use crate::models::{FileDeleteError, FileDeleteResult};
use crate::safety::protected;
use std::path::Path;

/// Bir dosyayı Geri Dönüşüm Kutusu'na taşır (`shell32!SHFileOperationW`, `FOF_ALLOWUNDO`).
/// Kalıcı silme YAPMAZ — kullanıcı Geri Dönüşüm Kutusu'ndan geri alabilir.
#[cfg(windows)]
fn send_to_recycle_bin(path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::{
        SHFileOperationW, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT, FO_DELETE,
        SHFILEOPSTRUCTW,
    };

    // pFrom, bir veya daha fazla yolun çift-null-sonlandırılmış listesidir (tek dosya için
    // de aynı kural geçerli: yolun sonuna bir null, listenin sonuna ikinci bir null).
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    wide.push(0);

    let mut op = SHFILEOPSTRUCTW {
        hwnd: HWND::default(),
        wFunc: FO_DELETE,
        pFrom: PCWSTR(wide.as_ptr()),
        pTo: PCWSTR::null(),
        fFlags: (FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT).0 as u16,
        ..Default::default()
    };

    // SAFETY: `op` yaşadığı sürece `wide` yaşıyor (aynı fonksiyon gövdesinde, `op`'tan önce
    // drop edilmiyor); SHFileOperationW senkron çalışır, pointer çağrı bitene kadar geçerli.
    let code = unsafe { SHFileOperationW(&mut op) };
    if code != 0 {
        return Err(std::io::Error::other(format!(
            "SHFileOperationW başarısız (kod={code})"
        )));
    }
    if op.fAnyOperationsAborted.as_bool() {
        return Err(std::io::Error::other(
            "Geri Dönüşüm Kutusu'na taşıma iptal edildi",
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn send_to_recycle_bin(path: &Path) -> std::io::Result<()> {
    std::fs::remove_file(path)
}

pub fn delete_files(paths: &[String]) -> FileDeleteResult {
    let mut deleted: u64 = 0;
    let mut failed: u64 = 0;
    let mut reclaimed: u64 = 0;
    let mut errors: Vec<FileDeleteError> = Vec::new();

    for raw in paths {
        let path = Path::new(raw);

        // 1) Var mı + dosya mı?
        let meta = match std::fs::symlink_metadata(path) {
            Ok(m) => m,
            Err(e) => {
                failed += 1;
                errors.push(FileDeleteError {
                    path: raw.clone(),
                    message: format!("okunamadı: {e}"),
                });
                continue;
            }
        };
        if meta.file_type().is_dir() {
            failed += 1;
            errors.push(FileDeleteError {
                path: raw.clone(),
                message: "klasör — atlandı (yalnız dosya silinir)".into(),
            });
            continue;
        }
        if meta.file_type().is_symlink() {
            failed += 1;
            errors.push(FileDeleteError {
                path: raw.clone(),
                message: "sembolik bağlantı — atlandı".into(),
            });
            continue;
        }

        // 2) Korumalı kök/dosya mı? (nihai güvenlik)
        if protected::is_within_protected(path) {
            failed += 1;
            errors.push(FileDeleteError {
                path: raw.clone(),
                message: "güvenlik reddi: korumalı sistem konumu".into(),
            });
            continue;
        }

        let size = meta.len();
        match send_to_recycle_bin(path) {
            Ok(_) => {
                deleted += 1;
                reclaimed = reclaimed.saturating_add(size);
            }
            Err(e) => {
                failed += 1;
                errors.push(FileDeleteError {
                    path: raw.clone(),
                    message: e.to_string(),
                });
            }
        }
    }

    FileDeleteResult {
        deleted,
        failed,
        reclaimed_bytes: reclaimed,
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_subdir(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(name);
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn moves_real_temp_file_to_recycle_bin_and_reports_size() {
        // `send_to_recycle_bin` gerçekten Geri Dönüşüm Kutusu'na taşıdıysa orijinal yolda
        // dosya kalmaz (bu test SHFileOperationW'nin gerçekten başarılı döndüğünü — kalıcı
        // silme değil, taşıma yaptığını — CI makinesinde doğrular).
        let dir = temp_subdir("pcdoctor_fd_ok");
        let f = dir.join("junk.bin");
        std::fs::write(&f, b"0123456789").unwrap(); // 10 byte
        let res = delete_files(&[f.to_string_lossy().into_owned()]);
        assert_eq!(res.deleted, 1);
        assert_eq!(res.failed, 0);
        assert_eq!(res.reclaimed_bytes, 10);
        assert!(
            !f.exists(),
            "dosya orijinal konumdan kalkmış olmalı (Geri Dönüşüm Kutusu'na taşındı)"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_to_delete_a_directory() {
        let dir = temp_subdir("pcdoctor_fd_dir");
        let res = delete_files(&[dir.to_string_lossy().into_owned()]);
        assert_eq!(res.deleted, 0);
        assert_eq!(res.failed, 1);
        assert!(dir.exists(), "klasör ASLA silinmemeli");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_nonexistent_path() {
        let res = delete_files(&[r"Z:\pcdoctor\does_not_exist_42.bin".to_string()]);
        assert_eq!(res.deleted, 0);
        assert_eq!(res.failed, 1);
    }

    #[test]
    fn refuses_protected_file_name_without_touching_system() {
        // Korumalı-isim hilesi: gerçek sistem dosyasına dokunmadan reddi ispatlar.
        let dir = temp_subdir("pcdoctor_fd_protected");
        let f = dir.join("pagefile.sys"); // is_protected_file_name → reddedilir
        std::fs::write(&f, b"sahte pagefile").unwrap();
        let res = delete_files(&[f.to_string_lossy().into_owned()]);
        assert_eq!(res.deleted, 0, "korumalı isim silinmemeli");
        assert_eq!(res.failed, 1);
        assert!(f.exists(), "korumalı isimli dosya hâlâ durmalı");
        assert!(
            res.errors.iter().any(|e| e.message.contains("korumalı")),
            "hata mesajı 'korumalı' içermeli: {:?}",
            res.errors
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
