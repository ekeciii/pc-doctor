//! Sprint 8 — Wininit EventID 1001 (autochk sonucu) fetch + parse.
//!
//! Reboot sonrası kullanıcıya "Son disk onarımı sonucu" banner için.
//! Fail-soft: Event Viewer read fail UI'da HATA göstermez.

use crate::models::ChkdskBootResult;
use crate::util::powershell;
use once_cell::sync::Lazy;
use regex::Regex;

/// "Repaired" / "fixed" / "düzeltildi"
static REPAIRED_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(repaired|fixed|düzeltildi|duzeltildi|onarıldı|onarildi)").unwrap()
});
/// "Found errors" / "hata bulundu" / "errors detected"
static ERRORS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(errors? (found|detected)|hata( |s).*bulundu|hata tespit)").unwrap()
});
/// "Successfully" / "successfully" / "başarıyla"
static CLEAN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(no problems found|successfully|başarıyla|basariyla|sorun bulunamadı|sorun bulunmadi)").unwrap()
});

pub fn fetch_last(volume: &str) -> Result<Option<ChkdskBootResult>, String> {
    // Volume zaten validate edildi; PowerShell injection için ek olarak whitelist:
    if !volume.chars().all(|c| c.is_ascii_alphabetic()) || volume.len() != 1 {
        return Err(format!("Geçersiz volume: {volume}"));
    }
    let script = format!(
        r#"
        $ErrorActionPreference = 'SilentlyContinue'
        $cutoff = (Get-Date).AddHours(-24)
        $ev = Get-WinEvent -FilterHashtable @{{
            ProviderName = 'Wininit'
            Id = 1001
            StartTime = $cutoff
        }} -MaxEvents 5 -ErrorAction SilentlyContinue
        if ($null -eq $ev) {{ return }}
        foreach ($e in $ev) {{
            if ($e.Message -match '{volume}:') {{
                @{{
                    occurredAt = $e.TimeCreated.ToString('o')
                    message = $e.Message
                }} | ConvertTo-Json -Compress -Depth 3
                break
            }}
        }}
    "#
    );
    let raw = powershell::run_cim(&script).unwrap_or_default();
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Ok(None);
    }
    let bundle: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };
    let occurred_at = bundle
        .get("occurredAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let message = bundle.get("message").and_then(|v| v.as_str()).unwrap_or("");
    Ok(Some(parse_wininit_event_message(
        volume.to_string(),
        occurred_at,
        message,
    )))
}

/// PII-safe parse: yalnız status + 3 özet satır. Dosya yolları/iç içerik DROP.
pub fn parse_wininit_event_message(
    volume: String,
    occurred_at: String,
    message: &str,
) -> ChkdskBootResult {
    let (status, exit_code) = if REPAIRED_RE.is_match(message) {
        ("repaired".to_string(), 1)
    } else if ERRORS_RE.is_match(message) {
        ("errorsFound".to_string(), 2)
    } else if CLEAN_RE.is_match(message) {
        ("clean".to_string(), 0)
    } else {
        ("unknown".to_string(), -1)
    };
    // Özet satırlar: yalnız ilk 3 non-empty satır, her biri 80 char truncate, path scrub.
    let summary_lines: Vec<String> = message
        .lines()
        .filter(|l| !l.trim().is_empty())
        .take(3)
        .map(scrub_line)
        .collect();
    ChkdskBootResult {
        volume,
        occurred_at,
        exit_code,
        status,
        summary_lines,
    }
}

fn scrub_line(line: &str) -> String {
    // Sprint 9 review H2 fix: \S boşluk içeren yolları kaçırıyordu.
    // Windows path-illegal karakterleri haricini tut: <>:"|?* + kontrol.
    // Bu over-scrub yapabilir (cümle sonu noktalama'yı da yutar) ama PII için
    // under-scrub'dan iyidir.
    static PATH_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r#"[A-Za-z]:\\[^\r\n<>"|?*]*"#).unwrap());
    let scrubbed = PATH_RE.replace_all(line, "<path>").to_string();
    scrubbed
        .chars()
        .take(80)
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_en_clean() {
        let r = parse_wininit_event_message(
            "C".into(),
            "2026-06-02T10:00:00Z".into(),
            "Checking file system on C:.\nNo problems found.",
        );
        assert_eq!(r.status, "clean");
        assert_eq!(r.exit_code, 0);
    }

    #[test]
    fn parse_tr_repaired() {
        let r = parse_wininit_event_message(
            "C".into(),
            "2026-06-02T10:00:00Z".into(),
            "C: üzerinde dosya sistemi denetleniyor.\nBozuk dosyalar düzeltildi.",
        );
        assert_eq!(r.status, "repaired");
    }

    #[test]
    fn parse_en_errors_found() {
        let r = parse_wininit_event_message(
            "C".into(),
            "2026-06-02T10:00:00Z".into(),
            "Errors found on C:. Run chkdsk /f again.",
        );
        assert_eq!(r.status, "errorsFound");
    }

    #[test]
    fn parse_garbage_fallback() {
        let r = parse_wininit_event_message(
            "C".into(),
            "x".into(),
            "??? completely unrecognized output ???",
        );
        assert_eq!(r.status, "unknown");
        assert_eq!(r.exit_code, -1);
    }

    #[test]
    fn scrub_replaces_paths() {
        let s = scrub_line("Repaired C:\\Users\\Ege\\Documents\\file.docx successfully.");
        assert!(!s.contains("C:\\Users"));
        assert!(s.contains("<path>"));
    }

    #[test]
    fn scrub_handles_paths_with_spaces() {
        // Sprint 9 review H2: "C:\Program Files\..." artık tamamen yutuluyor
        let s =
            scrub_line("Repaired C:\\Program Files\\Ege\\Documents\\Vergi 2026.docx successfully.");
        assert!(!s.contains("Program Files"));
        assert!(!s.contains("Ege"));
        assert!(!s.contains("Vergi"));
        assert!(s.contains("<path>"));

        // OneDrive multi-segment
        let s2 = scrub_line("Errors at C:\\Users\\Ege Yucel\\OneDrive - Org\\file.txt found.");
        assert!(!s2.contains("Ege Yucel"));
        assert!(!s2.contains("OneDrive"));
    }
}
