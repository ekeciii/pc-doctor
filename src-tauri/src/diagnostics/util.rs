//! Diagnostic-shared helpers — Sprint 7 B + G.
//!
//! - `truncate_safe`: UTF-8 safe truncate (char-boundary panic-free)
//! - `normalize_user_path`: `C:\Users\<name>\...` → `%USERPROFILE%\<USER>\...` (PII scrubbing)
//!   Sprint 7 review H4: USERPROFILE env-var olmasa veya multi-user yola karışsa bile maskele.
//! - `safe_disk_name`: ASCII alfasayısal + `-`/`_`/space whitelist (OEM friendly names normalize)
//! - `short_date`: ISO-8601 → "YYYY-MM-DD" (locale-bağımsız; event_log + crash_history paylaşımı)
//! - `sanitize_params`: Sprint 7 review H5 defense-in-depth — DB'ye yazılmadan ÖNCE params_json'ı
//!   per-category whitelist + deny-list ile süzer. Backend disiplini bypass olsa bile DB'de
//!   PII kalmaz.

use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;

const MAX_NAME_LEN: usize = 40;

/// `C:\Users\<X>\...` ya da `D:\Users\<X>\...` → `<DRIVE>:\Users\<USER>\...`
/// USERPROFILE env-var kontrolüne EK olarak çalışır.
static USERS_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)([A-Z]:\\Users\\)[^\\/:*?\x22<>|]+").unwrap());

pub fn truncate_safe(s: &str, n: usize) -> String {
    s.chars().take(n).collect::<String>().trim().to_string()
}

/// İki katmanlı normalize (Sprint 7 review H4):
///  1. USERPROFILE eşleşmesi varsa `%USERPROFILE%` ile değiştir
///  2. Diğer kullanıcı klasörlerini regex ile `<USER>` ile maskele
pub fn normalize_user_path(path: &str) -> String {
    let stage_1 = match std::env::var("USERPROFILE") {
        Ok(v) if !v.is_empty() => {
            let needle = v.to_lowercase();
            let lower = path.to_lowercase();
            if let Some(idx) = lower.find(&needle) {
                let head = &path[..idx];
                let tail = &path[idx + v.len()..];
                format!("{head}%USERPROFILE%{tail}")
            } else {
                path.to_string()
            }
        }
        _ => path.to_string(),
    };
    // Stage 2: multi-user defansif — \Users\foo\ → \Users\<USER>\
    USERS_RE.replace_all(&stage_1, "${1}<USER>").to_string()
}

pub fn safe_disk_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == ' ')
        .take(MAX_NAME_LEN)
        .collect::<String>()
        .trim()
        .to_string()
}

/// "2026-05-28T12:34:56.7890123+00:00" → "2026-05-28"
pub fn short_date(iso: &str) -> String {
    iso.split('T').next().unwrap_or(iso).to_string()
}

/// Sprint 7 review H5: DB'ye yazılmadan önce ÇİĞNENEMEZ defansif katman.
///
/// İki aşamalı kapı:
///   1. **DENY list**: bilinen PII anahtarlarını her kategoride at (sample, source,
///      path, hostname, userName, email, message, threatName, filePath, url, ip).
///   2. **ALLOW list (per-category)**: yalnız bilinen güvenli anahtarlar geçer.
///      Kategori bilinmiyorsa muhafazakar: yalnız allow-list union'ı geçer.
///
/// Backend disiplini bir yerde bozulsa bile DB'de PII kalmaz.
/// Kategori başına izinli (PII-güvenli) param anahtarları. Bilinmeyen kategori →
/// boş dilim (tüm params düşer). `sanitize_params` + `category_coverage` testi bunu
/// kullanır; lokalize kategori etiketi tek SSoT burada.
fn category_allow_list(category: &str) -> &'static [&'static str] {
    match category {
        "Disk" => &["mount", "freePercent", "freeFormatted"],
        "Sürücü" => &[
            "count",
            "deviceName",
            "manufacturer",
            "driverClass",
            "years",
        ],
        "Temizlik" => &["sizeGb"],
        "Virüs" => &["threatCount", "ageDays"],
        "Disk sağlığı" => &[
            "diskName",
            "healthStatus",
            "operationalStatus",
            "wearPercent",
            "temperatureC",
            "readErrors",
            "writeErrors",
        ],
        "Donanım" => &[
            "maxTemp",
            "maxTempPrecise",
            "zoneCount",
            "perfPercent",
            "loadPercent",
        ],
        "Güvenlik" => &["profiles", "vendor", "unknownCount", "suspiciousCount"],
        "Güncelleme" => &["count"],
        "Başlangıç" => &["seconds", "milliseconds", "count"],
        "Çökme geçmişi" => &["werCount", "signatureCount", "lastOccurred", "source"],
        "Olay günlüğü" => &[
            "count",
            "provider",
            "gpuVendor",
            "subsystem",
            "eventKind",
            "lastOccurredDate",
        ],
        "Sanal bellek" => &[
            "configuredMb",
            "ramMb",
            "recommendedMb",
            "ramGb",
            "peakMb",
            "allocatedMb",
            "usagePercent",
            "hiberfilMb",
            "freePercent",
        ],
        "Disk bütünlüğü" => &["errorCount", "volume"],
        _ => &[],
    }
}

pub fn sanitize_params(category: &str, params: &Value) -> Value {
    // `source` DENY listesinde DEĞİL — "Çökme geçmişi" kategorisinde whitelist'te ve
    // aşağıda normalize+truncate ile geçer. Diğer kategorilerde allow list zaten yutuyor.
    const DENY: &[&str] = &[
        "sample",
        "path",
        "hostname",
        "userName",
        "email",
        "message",
        "threatName",
        "filePath",
        "url",
        "ip",
        "domain",
        "fqdn",
    ];
    // Bilinmeyen kategori → boş allow-list → tüm params düşer. Bu KASITLI fail-safe
    // (deny-by-default; bkz. sanitize_unknown_category_drops_all testi). Bir KNOWN
    // diagnostic kategorisinin drift'i (rename) ise `category_coverage_*` testiyle
    // CI'da yakalanır — bu yüzden burada runtime panic'e gerek yok.
    let allow = category_allow_list(category);

    let obj = match params {
        Value::Object(m) => m,
        _ => return Value::Null,
    };
    let mut out = serde_json::Map::new();
    for (k, v) in obj {
        if DENY.contains(&k.as_str()) {
            continue;
        }
        if !allow.contains(&k.as_str()) {
            continue;
        }
        // "Çökme geçmişi"."source" — normalize edilmiş olsa bile path leak riski yüksek;
        // burada da defansif olarak truncate (60 char) garanti et.
        let safe_v = if category == "Çökme geçmişi" && k == "source" {
            match v {
                Value::String(s) => Value::String(truncate_safe(&normalize_user_path(s), 60)),
                _ => v.clone(),
            }
        } else {
            v.clone()
        };
        out.insert(k.clone(), safe_v);
    }
    Value::Object(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Her diagnostic'in CATEGORY sabiti `category_allow_list`'te boş-olmayan bir
    /// branch'e sahip olmalı. Bir kategori yeniden adlandırılıp util.rs
    /// güncellenmezse, o kategorinin TÜM params'ı sessizce history'den düşerdi
    /// (veri kaybı). Bu test o drift'i CI'da yüksek sesle yakalar — lokalize
    /// kategori etiketi ile allow-list'i birbirine bağlar.
    ///
    /// Kapsam: 11 diagnostic modülü + 2 inline kategori (disk_full, cleanup).
    #[test]
    fn category_coverage_every_emitted_category_has_allowlist() {
        use crate::diagnostics;
        let categories: &[(&str, &str)] = &[
            ("chkdsk", diagnostics::chkdsk::CATEGORY),
            ("crash_history", diagnostics::crash_history::CATEGORY),
            ("defender", diagnostics::defender::CATEGORY),
            ("drivers", diagnostics::drivers::CATEGORY),
            ("event_log", diagnostics::event_log::CATEGORY),
            ("pagefile", diagnostics::pagefile::CATEGORY),
            ("security_config", diagnostics::security_config::CATEGORY),
            ("smart", diagnostics::smart::CATEGORY),
            ("startup", diagnostics::startup::CATEGORY),
            ("thermal", diagnostics::thermal::CATEGORY),
            ("updates", diagnostics::updates::CATEGORY),
            ("disk_full", diagnostics::disk_full::CATEGORY),
            ("cleanup", crate::commands::CLEANUP_CATEGORY),
        ];
        for (module, cat) in categories {
            assert!(
                !category_allow_list(cat).is_empty(),
                "'{module}' kategorisi ('{cat}') category_allow_list'te branch'siz — \
                 params sessizce düşüyor. diagnostics/util.rs'e branch ekle."
            );
        }
    }

    #[test]
    fn truncate_handles_utf8_safely() {
        assert_eq!(truncate_safe("İçerik şudur böyledir", 5), "İçeri");
        assert_eq!(truncate_safe("abc", 10), "abc");
        assert_eq!(truncate_safe("  trim me  ", 6), "trim");
    }

    #[test]
    fn normalize_path_replaces_userprofile() {
        std::env::set_var("USERPROFILE", r"C:\Users\Ege");
        let out = normalize_user_path(r"C:\Users\Ege\AppData\Local\App\log.txt");
        assert_eq!(out, r"%USERPROFILE%\AppData\Local\App\log.txt");
    }

    #[test]
    fn normalize_path_masks_other_users() {
        // Even when USERPROFILE doesn't match, multi-user paths get masked.
        std::env::set_var("USERPROFILE", r"C:\Users\Ege");
        let out = normalize_user_path(r"C:\Users\Alice\Documents\secret.txt");
        assert_eq!(out, r"C:\Users\<USER>\Documents\secret.txt");
        // D drive Users folder also masked
        let out2 = normalize_user_path(r"D:\Users\Bob\file");
        assert_eq!(out2, r"D:\Users\<USER>\file");
    }

    #[test]
    fn safe_disk_name_strips_unsafe_chars() {
        assert_eq!(
            safe_disk_name("Samsung 990 PRO NVMe"),
            "Samsung 990 PRO NVMe"
        );
        assert_eq!(safe_disk_name("Drive<>|name"), "Drivename");
        let truncated = safe_disk_name("A really really really really really long disk name");
        assert!(truncated.len() <= 40, "got: {truncated:?}");
        assert!(truncated.starts_with("A really really really"));
    }

    #[test]
    fn short_date_extracts_yyyy_mm_dd() {
        assert_eq!(
            short_date("2026-05-28T12:34:56.7890123+00:00"),
            "2026-05-28"
        );
        assert_eq!(short_date("plain"), "plain");
    }

    #[test]
    fn sanitize_drops_deny_keys() {
        let input = serde_json::json!({
            "count": 5,
            "sample": "127.0.0.1 facebook.com",
            "message": "Application crashed at C:\\Users\\Ege\\foo.exe",
        });
        let out = sanitize_params("Güvenlik", &input);
        let obj = out.as_object().unwrap();
        assert!(!obj.contains_key("sample"));
        assert!(!obj.contains_key("message"));
        // count not in Güvenlik allow list either
        assert!(!obj.contains_key("count"));
    }

    #[test]
    fn sanitize_allows_per_category_whitelist() {
        let input = serde_json::json!({
            "mount": "C",
            "freePercent": "5.0",
            "freeFormatted": "5 GB",
            "extra": "should drop",
        });
        let out = sanitize_params("Disk", &input);
        let obj = out.as_object().unwrap();
        assert_eq!(obj.get("mount").unwrap(), "C");
        assert_eq!(obj.get("freePercent").unwrap(), "5.0");
        assert_eq!(obj.get("freeFormatted").unwrap(), "5 GB");
        assert!(!obj.contains_key("extra"));
    }

    #[test]
    fn sanitize_renormalizes_crash_source() {
        std::env::set_var("USERPROFILE", r"C:\Users\Ege");
        let input = serde_json::json!({
            "source": r"C:\Users\Ege\AppData\Local\evil.exe",
            "signatureCount": 42,
        });
        let out = sanitize_params("Çökme geçmişi", &input);
        let obj = out.as_object().unwrap();
        let src = obj.get("source").unwrap().as_str().unwrap();
        assert!(src.contains("%USERPROFILE%"), "got: {src}");
    }

    #[test]
    fn sanitize_unknown_category_drops_all() {
        let input = serde_json::json!({ "a": 1, "b": 2 });
        let out = sanitize_params("UnknownCategory", &input);
        let obj = out.as_object().unwrap();
        assert!(obj.is_empty());
    }
}
