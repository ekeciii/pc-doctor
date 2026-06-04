//! Pagefile + hibernation Finding'leri. **Code-only** (Sprint 6 — i18n incremental).
//! Frontend `resolveFinding` ile çevirir.

use crate::models::{Finding, FindingAction, MetricCode, PagefileSnapshot, Severity};
use serde_json::json;

const CATEGORY: &str = "Sanal bellek";

/// Sprint 9 D fix: 16 GiB sistem ölçümünde Win32_PhysicalMemory ile 16384 MiB üst sınırda
/// karışıklık yaşanmasını engelle. 256 MB tolerance — 16128 MB üstü "16 GB RAM" sayılır.
/// F1 (undersized) ve F2 (consider_managed) ortak eşik.
const RAM_16GB_THRESHOLD_MB: u64 = 16 * 1024 - 256; // 16128

pub fn evaluate(snap: &PagefileSnapshot) -> Vec<Finding> {
    let mut out = Vec::new();
    let ram_mb = snap.total_ram_mb.max(1);

    // === F1: manuel pagefile + max < 1.5×RAM + RAM < 16 GB → Warning
    if !snap.automatic_managed {
        let max_total: u64 = snap.configured.iter().map(|e| e.maximum_size_mb as u64).sum();
        let recommended_min = (ram_mb as f64 * 1.5) as u64;
        if ram_mb < RAM_16GB_THRESHOLD_MB && max_total < recommended_min {
            out.push(
                Finding::code_only(
                    "pagefile:undersized",
                    CATEGORY,
                    Severity::Warning,
                    "finding.pagefile.undersized.title",
                    "finding.pagefile.undersized.description",
                )
                .with_metric(format!("{} MB / {} MB", max_total, recommended_min))
                .with_metric_code(MetricCode::Bytes { value: max_total.saturating_mul(1024 * 1024) })
                .with_action(FindingAction::SetPagefileManaged)
                .with_action_code("finding.pagefile.undersized.action")
                .with_params(json!({
                    "configuredMb": max_total,
                    "recommendedMb": recommended_min,
                    "ramMb": ram_mb,
                })),
            );
        }
    }

    // === F2: manuel pagefile + RAM ≥ 16 GB → Info (System Managed öner)
    if !snap.automatic_managed && ram_mb >= RAM_16GB_THRESHOLD_MB {
        out.push(
            Finding::code_only(
                "pagefile:consider-managed",
                CATEGORY,
                Severity::Info,
                "finding.pagefile.consider_managed.title",
                "finding.pagefile.consider_managed.description",
            )
            .with_metric(format!("{} GB RAM", ram_mb / 1024))
            .with_metric_code(MetricCode::Bytes { value: ram_mb.saturating_mul(1024 * 1024) })
            .with_action(FindingAction::SetPagefileManaged)
            .with_action_code("finding.pagefile.consider_managed.action")
            .with_params(json!({ "ramGb": ram_mb / 1024 })),
        );
    }

    // === F3: peak/alloc > 0.90 → Warning (yetersiz pagefile basıncı)
    // GUARD: system-managed pagefile demand-driven; PeakUsage~=Allocated her zaman olur,
    // metrik gürültüsü olur. Sadece manuel ayarlanmış pagefile'da anlamlı.
    if !snap.automatic_managed && snap.allocated_mb > 0 {
        let ratio = snap.peak_mb as f64 / snap.allocated_mb as f64;
        if ratio > 0.90 {
            out.push(
                Finding::code_only(
                    "pagefile:high-usage",
                    CATEGORY,
                    Severity::Warning,
                    "finding.pagefile.high_usage.title",
                    "finding.pagefile.high_usage.description",
                )
                // Nötr metric — frontend resolveFinding değil Badge direkt basıyor.
                .with_metric(format!("{:.0}%", ratio * 100.0))
                .with_metric_code(MetricCode::Percentage { value: ratio * 100.0 })
                .with_action(FindingAction::OpenSystemPropertiesPerformance)
                .with_action_code("finding.pagefile.high_usage.action")
                .with_params(json!({
                    "peakMb": snap.peak_mb,
                    "allocatedMb": snap.allocated_mb,
                    "usagePercent": (ratio * 100.0).round() as u32,
                })),
            );
        }
    }

    // === F4: hibernation ON + desktop + hiberfil > 0.6×RAM + SSD + serbest < %15 → Info
    let free_ratio = if snap.system_drive_total_mb > 0 {
        snap.system_drive_free_mb as f64 / snap.system_drive_total_mb as f64
    } else {
        1.0
    };
    let hiberfil_big = snap.hiberfil_mb as f64 > (ram_mb as f64 * 0.6);
    if snap.hibernation_enabled
        && !snap.is_laptop
        && hiberfil_big
        && snap.system_drive_is_ssd
        && free_ratio < 0.15
    {
        out.push(
            Finding::code_only(
                "pagefile:hibernation-disk-pressure",
                CATEGORY,
                Severity::Info,
                "finding.pagefile.hibernation_disk_pressure.title",
                "finding.pagefile.hibernation_disk_pressure.description",
            )
            .with_metric(format!("hiberfil: {} MB", snap.hiberfil_mb))
            .with_metric_code(MetricCode::Bytes { value: snap.hiberfil_mb.saturating_mul(1024 * 1024) })
            .with_action_code("finding.pagefile.hibernation_disk_pressure.action")
            .with_params(json!({
                "hiberfilMb": snap.hiberfil_mb,
                "ramMb": ram_mb,
                "freePercent": (free_ratio * 100.0).round() as u32,
            })),
        );
    }

    out
}

#[cfg(test)]
mod tests {
    use crate::models::{PagefileEntry, PagefileSnapshot};
    use super::evaluate;

    fn snap_with_ram(ram_mb: u64, configured_max_mb: u32, automatic: bool) -> PagefileSnapshot {
        PagefileSnapshot {
            total_ram_mb: ram_mb,
            automatic_managed: automatic,
            configured: vec![PagefileEntry {
                name: "C:\\pagefile.sys".into(),
                initial_size_mb: 0,
                maximum_size_mb: configured_max_mb,
            }],
            allocated_mb: 0,
            peak_mb: 0,
            hibernation_enabled: false,
            hiberfil_mb: 0,
            system_drive_free_mb: 100_000,
            system_drive_total_mb: 500_000,
            is_laptop: false,
            system_drive_is_ssd: true,
        }
    }

    #[test]
    fn ram_16gib_falls_into_consider_managed_not_undersized() {
        // 16 GiB sistem (16384 MiB) — Sprint 9 D edge case:
        // Eski threshold ram_mb < 16384 (yani <) → 16384 F1'e DÜŞMEZ, F2'ye DÜŞER (OK).
        // Yeni threshold RAM_16GB_THRESHOLD_MB = 16128: 16384 >= 16128 → F2.
        let snap = snap_with_ram(16_384, 0, false);
        let findings = evaluate(&snap);
        let ids: Vec<&str> = findings.iter().map(|f| f.id.as_str()).collect();
        assert!(
            ids.contains(&"pagefile:consider-managed"),
            "16 GiB sistem F2 (consider_managed) dalında olmalı, got: {ids:?}"
        );
        assert!(!ids.contains(&"pagefile:undersized"));
    }

    #[test]
    fn ram_15_75_gib_now_treated_as_16_gib_via_tolerance() {
        // 15.75 GiB = 16128 MiB — 256 MB tolerance ile 16 GB sayılır (Sprint 9 D fix).
        // Önceki kod 16128 < 16384 olduğu için F1'e düşerdi (yetersiz pagefile false positive).
        let snap = snap_with_ram(16_128, 0, false);
        let findings = evaluate(&snap);
        let ids: Vec<&str> = findings.iter().map(|f| f.id.as_str()).collect();
        assert!(ids.contains(&"pagefile:consider-managed"));
        assert!(!ids.contains(&"pagefile:undersized"));
    }

    #[test]
    fn ram_8gib_remains_undersized_if_no_pagefile() {
        let snap = snap_with_ram(8 * 1024, 0, false);
        let findings = evaluate(&snap);
        let ids: Vec<&str> = findings.iter().map(|f| f.id.as_str()).collect();
        assert!(
            ids.contains(&"pagefile:undersized"),
            "8 GB RAM + 0 pagefile = undersized, got: {ids:?}"
        );
    }

    #[test]
    fn automatic_managed_silences_undersized_and_consider() {
        let snap = snap_with_ram(8 * 1024, 0, true);
        let findings = evaluate(&snap);
        let ids: Vec<&str> = findings.iter().map(|f| f.id.as_str()).collect();
        assert!(!ids.contains(&"pagefile:undersized"));
        assert!(!ids.contains(&"pagefile:consider-managed"));
    }
}
