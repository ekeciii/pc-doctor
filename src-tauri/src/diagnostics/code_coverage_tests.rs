//! Faz 8 — i18n kod kapsama testi (runtime, dinamik olarak inşa edilen kodlar için).
//!
//! `scripts/check-i18n.mjs` Check 4 zaten `src-tauri/src/**.rs` içindeki TÜM LİTERAL
//! `"finding.<cat>.<id>.<field>"` string'lerini `findings.tr.ts` anahtarlarıyla karşılaştırıyor —
//! ama bu yalnız literal'leri yakalar. `thermal.rs`/`drivers.rs`/`event_log.rs`/`disk_full.rs`
//! bazı kodları `format!("finding.<cat>.{code_id}.title")` gibi RUNTIME'da inşa ediyor; bu
//! string'ler kaynak kodda hiçbir zaman tek bir literal olarak görünmez, dolayısıyla statik
//! grep'in kapsamı DIŞINDA kalırlar (check-i18n.mjs'in kendi docstring'i bu boşluğu belgeler).
//!
//! Bu test dosyası o dört modülün `evaluate()` fonksiyonlarını, her runtime-inşa edilen kod
//! dalını (severity eşiği, code_id varyasyonu) tetikleyecek sentetik girdilerle çağırır, ortaya
//! çıkan her `Finding`'in `title_code`/`description_code`/`action_code`/`recommendation_code`
//! alanlarını toplar ve gerçek `findings.tr.ts` (SSoT) içindeki anahtar kümesiyle karşılaştırır.
//!
//! Diğer 8 tanı modülü (chkdsk, crash_history, defender, pagefile, security_config, smart,
//! startup, updates) kodlarını tamamen literal string olarak yazıyor — onlar zaten
//! check-i18n.mjs'in statik taramasıyla kapsanıyor, burada tekrar edilmiyor.

use super::{disk_full, drivers, event_log, thermal};
use crate::models::{DriverInfo, EventLogSignature, Finding, ThermalSnapshot, VolumeInfo};
use regex::Regex;
use std::collections::HashSet;

/// `findings.tr.ts` (SSoT) içindeki tüm `finding.` ile başlayan dört parçalı anahtarları çıkarır.
/// Değerleri (çok satırlı olabilirler) parse etmeye gerek yok — yalnız anahtar var mı bakıyoruz.
fn known_codes() -> HashSet<String> {
    // Repo kökü: src-tauri/src/diagnostics/ -> (3x yukarı) -> repo kökü -> src/lib/i18n/...
    let raw = include_str!("../../../src/lib/i18n/findings.tr.ts");
    let re = Regex::new(r#""(finding\.[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+)"\s*:"#).unwrap();
    re.captures_iter(raw).map(|c| c[1].to_string()).collect()
}

/// Bir Finding'in dört kod alanını (varsa) `(modül, alan, kod)` üçlüsü olarak topla.
fn collect_codes<'a>(
    module: &'a str,
    findings: &'a [Finding],
) -> Vec<(&'a str, &'static str, String)> {
    let mut out = Vec::new();
    for f in findings {
        if let Some(c) = &f.title_code {
            out.push((module, "title_code", c.clone()));
        }
        if let Some(c) = &f.description_code {
            out.push((module, "description_code", c.clone()));
        }
        if let Some(c) = &f.action_code {
            out.push((module, "action_code", c.clone()));
        }
        if let Some(c) = &f.recommendation_code {
            out.push((module, "recommendation_code", c.clone()));
        }
    }
    out
}

fn thermal_snap(
    zones: Vec<f64>,
    perf: Option<f64>,
    load: Option<f64>,
    on_ac: Option<bool>,
) -> ThermalSnapshot {
    ThermalSnapshot {
        zones_celsius: zones,
        processor_performance_percent_avg: perf,
        processor_load_percent_avg: load,
        is_laptop: on_ac.is_some(),
        on_ac_power: on_ac,
    }
}

fn drv(signed: bool, age_days: i64) -> DriverInfo {
    DriverInfo {
        device_name: "Test Device".into(),
        manufacturer: "Test".into(),
        driver_version: "1.0".into(),
        driver_date: "2020-01-01".into(),
        is_signed: signed,
        class: "Net".into(),
        age_days,
    }
}

fn evt(provider: &str, event_id: u32, count: u32) -> EventLogSignature {
    EventLogSignature {
        provider: provider.into(),
        event_id,
        level: "Error".into(),
        count,
        first_occurred: "2026-01-01T00:00:00Z".into(),
        last_occurred: "2026-01-02T00:00:00Z".into(),
        sample_message: "test".into(),
    }
}

fn vol(mount: &str, free_percent: f64) -> VolumeInfo {
    let total: u64 = 100_000_000_000;
    let used_percent = 100.0 - free_percent;
    let used = (total as f64 * used_percent / 100.0) as u64;
    VolumeInfo {
        mount_point: mount.into(),
        label: None,
        file_system: "NTFS".into(),
        total_bytes: total,
        free_bytes: total.saturating_sub(used),
        used_bytes: used,
        used_percent,
    }
}

#[test]
fn runtime_constructed_finding_codes_exist_in_findings_tr_dict() {
    let dict = known_codes();
    assert!(
        dict.len() > 100,
        "findings.tr.ts anahtar sayısı beklenenden düşük ({}) — include_str! yolu/regex bozulmuş olabilir",
        dict.len()
    );

    let mut all: Vec<(&str, &'static str, String)> = Vec::new();

    // === thermal.rs: sıcaklık critical/warning (format!-inşa) + throttling (zaten literal,
    // regresyon için burada da tutuluyor) ===
    let thermal_temp_critical = thermal::evaluate(&thermal_snap(vec![90.0], None, None, None)); // >=85 -> critical
    all.extend(collect_codes("thermal", &thermal_temp_critical));
    let thermal_temp_warning = thermal::evaluate(&thermal_snap(vec![80.0], None, None, None)); // 75..85 -> warning
    all.extend(collect_codes("thermal", &thermal_temp_warning));
    let thermal_throttle_critical =
        thermal::evaluate(&thermal_snap(vec![], Some(60.0), Some(60.0), Some(true))); // throttling critical
    all.extend(collect_codes("thermal", &thermal_throttle_critical));
    let thermal_throttle_warning =
        thermal::evaluate(&thermal_snap(vec![], Some(80.0), Some(60.0), Some(true))); // throttling warning
    all.extend(collect_codes("thermal", &thermal_throttle_warning));

    // === drivers.rs: unsigned_summary + outdated_summary (format!-inşa), tek çağrıda ikisi de ===
    let drivers_findings = drivers::evaluate(&[
        drv(false, 100), // unsigned
        drv(true, 2000), // old (>=1095)
    ]);
    all.extend(collect_codes("drivers", &drivers_findings));

    // === event_log.rs: 5 code_prefix, hepsi format!-inşa ===
    let event_log_findings = event_log::evaluate(&[
        evt("Kernel-Power", 41, 3),     // kernel_power_41 (n>=3 -> action dahil)
        evt("WHEA-Logger", 1, 2),       // whea_or_bugcheck
        evt("nvlddmkm", 1, 10),         // gpu_driver_error
        evt("disk", 1, 10),             // disk_or_ntfs_error
        evt("application hang", 1, 10), // application_crash (recommendation YOK)
    ]);
    all.extend(collect_codes("event_log", &event_log_findings));

    // === disk_full.rs: full/warning/info (title/description format!-inşa) ===
    let disk_full_findings = disk_full::evaluate(&[
        vol("D:\\", 5.0),  // <10 -> full
        vol("E:\\", 12.0), // 10..15 -> warning
        vol("F:\\", 18.0), // 15..20 -> info
    ]);
    all.extend(collect_codes("disk_full", &disk_full_findings));

    assert!(
        all.len() >= 20,
        "beklenenden az kod toplandı ({}) — sentetik girdiler tüm dalları tetiklemiyor olabilir",
        all.len()
    );

    let missing: Vec<String> = all
        .iter()
        .filter(|(_, _, code)| !dict.contains(code))
        .map(|(module, field, code)| {
            format!("{module}.{field} -> \"{code}\" (findings.tr.ts'de YOK)")
        })
        .collect();

    assert!(
        missing.is_empty(),
        "\nRuntime'da inşa edilen {} kod findings.tr.ts'de bulunamadı:\n  {}\n",
        missing.len(),
        missing.join("\n  ")
    );
}
