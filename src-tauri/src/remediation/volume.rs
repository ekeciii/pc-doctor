//! Sprint 8 — paylaşılan volume validation + system-drive tespiti.
//!
//! chkdsk, chkntfs ve schedule_chkdsk_fix hepsi aynı `VOLUME_RE`'yi kullanır.
//! Modül bazlı copy YASAK (invariant #1).

use once_cell::sync::Lazy;
use regex::Regex;

pub static VOLUME_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-Z]$").unwrap());

/// Tek-harf uppercase volume — geçersizse `Err`.
pub fn validate_volume(s: &str) -> Result<&str, String> {
    if VOLUME_RE.is_match(s) {
        Ok(s)
    } else {
        Err(format!(
            "Geçersiz volume: '{s}' — sadece tek harf (A-Z) izinli."
        ))
    }
}

/// `%SystemDrive%` ile karşılaştır (genelde "C"). Env yoksa "C" varsay.
pub fn is_system_drive(volume: &str) -> bool {
    let sd = std::env::var("SystemDrive")
        .unwrap_or_else(|_| "C:".into())
        .trim_end_matches(':')
        .to_uppercase();
    volume.eq_ignore_ascii_case(&sd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_accepts_single_uppercase() {
        for c in 'A'..='Z' {
            assert!(validate_volume(&c.to_string()).is_ok(), "{c}");
        }
    }

    #[test]
    fn validate_rejects_garbage() {
        for bad in ["foo/../bar", "C:", "c", "CC", "", "C\n", ".", "1", "C/", "C\\"] {
            assert!(validate_volume(bad).is_err(), "should reject: {bad:?}");
        }
    }

    #[test]
    fn is_system_drive_uses_env() {
        std::env::set_var("SystemDrive", "C:");
        assert!(is_system_drive("C"));
        assert!(!is_system_drive("D"));
        assert!(is_system_drive("c")); // case-insensitive
    }
}
