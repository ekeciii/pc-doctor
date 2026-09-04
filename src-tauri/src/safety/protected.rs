//! Sprint 14 — kullanıcı-seçimli dosya silme için "dokunma" guard'ı.
//!
//! Büyük/kullanılmayan dosya tarayıcısı kullanıcının KENDİ dosyalarını siler (allowlist'e
//! girmez). Yine de OS bütünlüğünü bozacak yolları hem TARAMADA atlarız hem SİLMEDEN önce
//! reddederiz (çift güvenlik). Burada listelenen kökler asla taranmaz/silinmez.

use std::path::{Path, PathBuf};

/// Hiçbir koşulda taranmayan/silinmeyen klasör kökleri (sistem + program + kasa).
pub fn protected_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    let windows_root = std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("C:\\Windows"));
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let sd = |sub: &str| PathBuf::from(format!("{}\\{}", system_drive, sub));

    roots.push(windows_root);
    roots.push(sd("Program Files"));
    roots.push(sd("Program Files (x86)"));
    roots.push(sd("ProgramData"));
    roots.push(sd("$Recycle.Bin"));
    roots.push(sd("System Volume Information"));
    roots.push(sd("$WinREAgent"));
    roots.push(sd("Recovery"));
    // Tüm sürücülerdeki kasa klasörleri (D:\$Recycle.Bin gibi) walk sırasında ayrıca
    // dir-adı bazlı da elenir (skip_dir_name).
    roots
}

/// Walk sırasında ada göre atlanan klasörler (her sürücüde geçerli).
pub fn skip_dir_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "$recycle.bin"
            | "system volume information"
            | "$winreagent"
            | "windows"
            | "recovery"
            | "config.msi"
    )
}

/// Silinmesi tehlikeli, asla dokunulmayan dosya adları (sistem sayfa/uyku dosyaları vb.).
pub fn is_protected_file_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "pagefile.sys" | "hiberfil.sys" | "swapfile.sys" | "ntuser.dat" | "bootmgr"
    )
}

/// Bir yol korumalı bir kökün altında mı? (silme öncesi nihai kontrol)
pub fn is_within_protected(path: &Path) -> bool {
    let canonical = path.canonicalize().unwrap_or_else(|_| normalize(path));
    for root in protected_roots() {
        let nr = root.canonicalize().unwrap_or_else(|_| normalize(&root));
        if canonical.starts_with(&nr) {
            return true;
        }
    }
    if let Some(name) = canonical.file_name().and_then(|n| n.to_str()) {
        if is_protected_file_name(name) {
            return true;
        }
    }
    false
}

fn normalize(path: &Path) -> PathBuf {
    use std::path::Component;
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skip_dir_name_matches_vault_and_system_folders() {
        assert!(skip_dir_name("$Recycle.Bin"));
        assert!(skip_dir_name("System Volume Information"));
        assert!(skip_dir_name("WINDOWS")); // case-insensitive
        assert!(skip_dir_name("config.msi"));
        assert!(!skip_dir_name("Documents"));
        assert!(!skip_dir_name("Downloads"));
    }

    #[test]
    fn protected_file_names_are_case_insensitive() {
        assert!(is_protected_file_name("pagefile.sys"));
        assert!(is_protected_file_name("PAGEFILE.SYS"));
        assert!(is_protected_file_name("hiberfil.sys"));
        assert!(is_protected_file_name("ntuser.dat"));
        assert!(!is_protected_file_name("notes.txt"));
    }

    #[test]
    fn is_within_protected_flags_real_system_file() {
        // Var olan gerçek bir sistem dosyası → canonicalize başarılı, SystemRoot
        // kökü altında → korumalı. (Dosyaya DOKUNULMAZ, sadece sınıflandırılır.)
        let win = std::env::var_os("SystemRoot")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
        let kernel = win.join("System32").join("kernel32.dll");
        if kernel.exists() {
            assert!(
                is_within_protected(&kernel),
                "System32 altı korumalı olmalı"
            );
        }
    }

    #[test]
    fn is_within_protected_allows_plain_temp_file() {
        let f = std::env::temp_dir().join("pcdoctor_plain.txt");
        assert!(
            !is_within_protected(&f),
            "sıradan temp dosyası korumalı olmamalı"
        );
    }

    #[test]
    fn is_within_protected_flags_protected_file_name_anywhere() {
        // pagefile.sys adı her konumda reddedilir (dosya yoksa normalize fallback).
        let f = std::env::temp_dir().join("pagefile.sys");
        assert!(is_within_protected(&f));
    }
}
