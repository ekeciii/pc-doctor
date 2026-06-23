//! Sprint 14 — kullanıcı-seçimli dosya kalıcı silme.
//!
//! Büyük/kullanılmayan dosya tarayıcısında işaretlenen dosyaları kalıcı siler. Her yol
//! silmeden önce `safety::protected` ile yeniden denetlenir (UI'ı atlayan/elle gelen yollar
//! için çift güvenlik). Sadece DOSYA siler — dizin asla.

use crate::models::{FileDeleteError, FileDeleteResult};
use crate::safety::protected;
use std::path::Path;

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
        match std::fs::remove_file(path) {
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
    fn deletes_real_temp_file_and_reports_reclaimed_bytes() {
        let dir = temp_subdir("pcdoctor_fd_ok");
        let f = dir.join("junk.bin");
        std::fs::write(&f, b"0123456789").unwrap(); // 10 byte
        let res = delete_files(&[f.to_string_lossy().into_owned()]);
        assert_eq!(res.deleted, 1);
        assert_eq!(res.failed, 0);
        assert_eq!(res.reclaimed_bytes, 10);
        assert!(!f.exists(), "dosya silinmiş olmalı");
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
