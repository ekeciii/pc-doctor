use crate::admin::{self, NEEDS_ELEVATION, RESTORE_FAILED, SCHEDULE_INCONSISTENT, VOLUME_LOCKED};
use crate::collectors::{
    chkdsk_volumes, cleanup_targets, crash_history, defender, disk, drivers, event_log, pagefile,
    security_config, smart, startup, thermal, updates,
};
use crate::diagnostics::{
    chkdsk as chkdsk_diag, crash_history as crash_diag, defender as defender_diag, disk_full,
    drivers as drivers_diag, event_log as event_log_diag, pagefile as pagefile_diag,
    security_config as security_diag, smart as smart_diag, startup as startup_diag,
    thermal as thermal_diag, updates as updates_diag,
};
use crate::models::{
    ChkdskBootResult, ChkdskCancelOutcome, ChkdskFixResult, ChkdskResult, CleanupResult,
    CleanupTarget, DefenderScanResult, FixAllOutcome, FixItemResult, FixSpec, PendingChkdsk,
    ScanReport, SfcDismSummary,
};
use crate::remediation::{
    chkdsk as chkdsk_remediation, chkdsk_boot_result, chkntfs, cleanup, defender_scan, reboot,
    system_file_check, volume as vol_util,
};
use crate::safety::{pending_state, restore_point};
use chrono::Utc;
use once_cell::sync::Lazy;
use std::collections::HashSet;
use tauri_plugin_opener::OpenerExt;

/// Bilinen + onaylanmış URL allowlist'i. Frontend `open_oem_link` ile yalnızca bunları açabilir.
static ALLOWED_SCHEME_URIS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    HashSet::from([
        "ms-settings:windowsupdate",
        "ms-settings:powersleep",
        "ms-settings:notifications",
        "ms-settings:windowsdefender",
        "ms-settings:deviceencryption",
        "ms-settings:network-status",
        "ms-settings:startupapps",
        "windowsdefender://threat",
        "windowsdefender://network",
    ])
});

/// HTTPS için izin verilen tam host listesi.
static ALLOWED_HTTPS_HOSTS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    HashSet::from([
        "www.nvidia.com",
        "www.amd.com",
        "www.intel.com",
        "www.realtek.com",
        "www.google.com", // driver fallback aramaları için
    ])
});

#[tauri::command]
pub async fn scan() -> Result<ScanReport, String> {
    tauri::async_runtime::spawn_blocking(scan_blocking)
        .await
        .map_err(|e| format!("Tarama görevi başarısız: {}", e))
}

/// Bloklayan paralel scan — her kolektör ayrı OS thread'inde, hepsi join.
fn scan_blocking() -> ScanReport {
    std::thread::scope(|s| {
        let h_vol = s.spawn(disk::list_volumes);
        let h_events = s.spawn(event_log::scan_recent_critical);
        let h_drv = s.spawn(drivers::list_outdated_drivers);
        let h_def_status = s.spawn(defender::collect_status);
        let h_def_threats = s.spawn(defender::collect_recent_threats);
        let h_smart = s.spawn(smart::collect);
        let h_thermal = s.spawn(thermal::snapshot);
        let h_sec = s.spawn(security_config::collect);
        let h_updates = s.spawn(updates::snapshot);
        let h_startup = s.spawn(startup::snapshot);
        let h_crash = s.spawn(crash_history::snapshot);
        let h_pagefile = s.spawn(pagefile::snapshot);
        let h_chkdsk_vols = s.spawn(chkdsk_volumes::collect);
        let h_clean = s.spawn(cleanup_targets::scan_all);

        let volumes = h_vol.join().unwrap_or_default();
        let event_signatures = h_events.join().unwrap_or_default();
        let outdated_drivers = h_drv.join().unwrap_or_default();
        let defender_status = h_def_status.join().unwrap_or_default();
        let threats = h_def_threats.join().unwrap_or_default();
        let smart_disks = h_smart.join().unwrap_or_default();
        let thermal_snap = h_thermal.join().unwrap_or_default();
        let security = h_sec.join().unwrap_or_default();
        let updates_snap = h_updates.join().unwrap_or_default();
        let startup_info = h_startup.join().unwrap_or_default();
        let crash_hist = h_crash.join().unwrap_or_default();
        let pagefile_snap = h_pagefile.join().ok().flatten();
        let chkdsk_vols = h_chkdsk_vols.join().unwrap_or_default();
        let cleanup_targets = h_clean.join().unwrap_or_default();

        let mut findings = disk_full::evaluate(&volumes);
        findings.extend(event_log_diag::evaluate(&event_signatures));
        findings.extend(drivers_diag::evaluate(&outdated_drivers));
        if let Some(ref status) = defender_status {
            let mut status_with_count = status.clone();
            status_with_count.active_threat_count = threats
                .iter()
                .filter(|t| matches!(t.status.as_str(), "Detected" | "Active" | "Allowed"))
                .count() as u32;
            findings.extend(defender_diag::evaluate(&status_with_count, &threats));
        }
        findings.extend(smart_diag::evaluate(&smart_disks));
        findings.extend(thermal_diag::evaluate(&thermal_snap));
        findings.extend(security_diag::evaluate(&security));
        findings.extend(updates_diag::evaluate(&updates_snap));
        findings.extend(startup_diag::evaluate(&startup_info));
        findings.extend(crash_diag::evaluate(&crash_hist));
        if let Some(ref pf) = pagefile_snap {
            findings.extend(pagefile_diag::evaluate(pf));
        }
        findings.extend(chkdsk_diag::evaluate(&chkdsk_vols));
        findings.sort_by_key(|f| severity_order(&f.severity));

        // Faz 1: her bulgunun düzeltme katmanını aksiyonundan merkezi türet.
        for f in &mut findings {
            f.fix_tier = crate::models::FixTier::from_action(f.action.as_ref());
        }

        let health = crate::health::compute_health(&findings);
        let total_reclaimable_bytes = cleanup_targets.iter().map(|t| t.size_bytes).sum();
        ScanReport {
            generated_at: Utc::now().to_rfc3339(),
            volumes,
            findings,
            cleanup_targets,
            total_reclaimable_bytes,
            health,
        }
    })
}

fn severity_order(s: &crate::models::Severity) -> u8 {
    use crate::models::Severity::*;
    match s {
        Critical => 0,
        Warning => 1,
        Info => 2,
        Good => 3,
    }
}

#[tauri::command]
pub fn list_cleanup_targets() -> Vec<CleanupTarget> {
    cleanup_targets::scan_all()
}

#[tauri::command]
pub fn is_elevated() -> bool {
    admin::is_elevated()
}

#[tauri::command]
pub fn relaunch_as_admin(app: tauri::AppHandle) -> Result<(), String> {
    admin::relaunch_as_admin()?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn is_system_restore_enabled() -> bool {
    restore_point::is_enabled()
}

#[tauri::command]
pub fn create_restore_point(description: String) -> Result<(), String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: Sistem Geri Yükleme noktası oluşturmak için yönetici yetkisi gerek.",
            NEEDS_ELEVATION
        ));
    }
    restore_point::create(&description).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn execute_cleanup(
    target_ids: Vec<String>,
    force_without_restore: bool,
) -> Result<CleanupResult, String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: Temizlik işlemi için yönetici yetkisi gerek (System Restore + korumalı klasörler).",
            NEEDS_ELEVATION
        ));
    }

    let mut restore_point_created = false;
    let mut restore_point_skipped_reason: Option<String> = None;

    match restore_point::create("PC Doctor: otomatik temizlik öncesi") {
        Ok(_) => restore_point_created = true,
        Err(e) => {
            restore_point_skipped_reason = Some(e.to_string());
            if !force_without_restore {
                // Sprint 7 (C): locale-agnostic sentinel. Frontend `RestoreFailedError`
                // ile yakalar ve recovery banner gösterir.
                return Err(format!("{RESTORE_FAILED}: {}", e));
            }
        }
    }

    let per_target = cleanup::execute(&target_ids);
    let reclaimed_bytes = per_target.iter().map(|r| r.reclaimed_bytes).sum();

    Ok(CleanupResult {
        reclaimed_bytes,
        per_target,
        restore_point_created,
        restore_point_skipped_reason,
    })
}

/// Faz 1 — "Hepsini Düzelt" orkestratörü.
///
/// Bir `FixSpec` listesini **tek** elevation kontrolü + **tek** System Restore noktası
/// altında sırayla uygular. Tekil komutların (her biri kendi restore point'ini oluşturur)
/// aksine batch için tek nokta açar. Bir fix patlarsa diğerleri devam eder (izolasyon);
/// sonunda madde madde sonuç + reboot grubu döner.
///
/// Ağır streaming onarımlar (sfc/DISM, Defender, chkdsk) bilinçli olarak burada DEĞİL —
/// kendi butonları + ilerleme dialoglarıyla ayrı çalışır. Faz 2 config fix'leri
/// (başlangıç, pagefile, firewall/UAC, güncelleme) `FixSpec`'e eklenince otomatik kapsanır.
#[tauri::command]
pub fn run_fix_all(
    fixes: Vec<FixSpec>,
    force_without_restore: bool,
) -> Result<FixAllOutcome, String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: Düzeltmeler için yönetici yetkisi gerek (System Restore + korumalı işlemler).",
            NEEDS_ELEVATION
        ));
    }

    // Tek restore point — batch'in tamamı için.
    let mut restore_point_created = false;
    let mut restore_point_skipped_reason: Option<String> = None;
    match restore_point::create("PC Doctor: Hepsini Düzelt öncesi") {
        Ok(_) => restore_point_created = true,
        Err(e) => {
            restore_point_skipped_reason = Some(e.to_string());
            if !force_without_restore {
                return Err(format!("{RESTORE_FAILED}: {}", e));
            }
        }
    }

    let items: Vec<FixItemResult> = fixes.iter().map(run_one_fix).collect();
    Ok(summarize_fix_all(
        items,
        restore_point_created,
        restore_point_skipped_reason,
    ))
}

/// Tek bir fix'i uygular (izole — panik/hata batch'i durdurmaz). Tekil remediation
/// fonksiyonlarını doğrudan çağırır (komut sarmalayıcılarını değil) ki restore point
/// tekrarlanmasın.
fn run_one_fix(spec: &FixSpec) -> FixItemResult {
    let id = spec.id().to_string();
    let reboot_required = spec.requires_reboot();
    match spec {
        FixSpec::Cleanup { target_ids } => {
            let per = cleanup::execute(target_ids);
            let any_err = per.iter().any(|r| r.error.is_some());
            FixItemResult {
                id,
                ok: !any_err,
                message_code: None,
                reboot_required,
            }
        }
    }
}

/// Per-item sonuçlardan batch özetini üretir (saf — test edilebilir).
fn summarize_fix_all(
    items: Vec<FixItemResult>,
    restore_point_created: bool,
    restore_point_skipped_reason: Option<String>,
) -> FixAllOutcome {
    let applied = items.iter().filter(|i| i.ok).count() as u32;
    let failed = items.iter().filter(|i| !i.ok).count() as u32;
    let reboot_required = items
        .iter()
        .filter(|i| i.reboot_required && i.ok)
        .map(|i| i.id.clone())
        .collect();
    FixAllOutcome {
        restore_point_created,
        restore_point_skipped_reason,
        applied,
        failed,
        items,
        reboot_required,
    }
}

#[tauri::command]
pub async fn run_system_file_check(app: tauri::AppHandle) -> Result<SfcDismSummary, String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: Sistem dosyası onarımı için yönetici yetkisi gerek.",
            NEEDS_ELEVATION
        ));
    }
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || system_file_check::run(app2))
        .await
        .map_err(|e| format!("Onarım görevi başarısız: {}", e))?
}

#[tauri::command]
pub async fn run_defender_quick_scan(app: tauri::AppHandle) -> Result<DefenderScanResult, String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: Defender taraması için yönetici yetkisi gerek.",
            NEEDS_ELEVATION
        ));
    }
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || defender_scan::run(app2))
        .await
        .map_err(|e| format!("Tarama görevi başarısız: {}", e))?
}

/// Sprint 6: chkdsk /scan (read-only, admin gerek). System disk /f Sprint 7.
#[tauri::command]
pub async fn run_chkdsk_scan(
    app: tauri::AppHandle,
    volume: String,
) -> Result<ChkdskResult, String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: chkdsk için yönetici yetkisi gerek.",
            NEEDS_ELEVATION
        ));
    }
    let app2 = app.clone();
    let vol = volume.clone();
    tauri::async_runtime::spawn_blocking(move || chkdsk_remediation::run_scan(app2, vol))
        .await
        .map_err(|e| format!("Tarama görevi başarısız: {}", e))?
}

/// Sprint 6 + Sprint 13 refactor: chkdsk session cancel.
/// Eski signature `bool` (yanıltıcı `cleared || aborted`) → `ChkdskCancelOutcome`
/// (Sprint 8'den beri var; H2/H3 fix'lerinde gerçek durum dönüyor).
/// Frontend cancel butonu veya app exit hook'undan çağrılır. Admin gerekmez.
/// Sprint 12 H1+H3+H5 multi-volume invariant: cancel_session ScheduledFix dalında volume
/// döner; pending_state::remove(volume) yapılır (clear DEĞİL).
#[tauri::command]
pub fn cancel_chkdsk_scan(app: tauri::AppHandle) -> ChkdskCancelOutcome {
    let (schedule_cleared, reboot_aborted, cancelled_volume) =
        chkdsk_remediation::cancel_session();
    if schedule_cleared {
        if let Some(v) = cancelled_volume.as_ref() {
            let _ = pending_state::remove(&app, v);
        }
    }
    ChkdskCancelOutcome {
        schedule_cleared,
        reboot_aborted,
    }
}

// =====================================================
// Sprint 8 — chkdsk /f remediation
// =====================================================

/// chkdsk /f akışı:
/// 1. admin gate
/// 2. volume validate
/// 3. RestorePoint create (fail + !force → RESTORE_FAILED sentinel)
/// 4. is_system_drive(volume) dispatch:
///    - true  → schedule_system_fix (chkntfs /c, pending_state::write)
///    - false → run_nonsystem_fix (live stream, /f)
#[tauri::command]
pub async fn run_chkdsk_fix(
    app: tauri::AppHandle,
    volume: String,
    force_without_restore: bool,
) -> Result<ChkdskFixResult, String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: chkdsk /f için yönetici yetkisi gerek.",
            NEEDS_ELEVATION
        ));
    }
    vol_util::validate_volume(&volume)?;
    let is_system = vol_util::is_system_drive(&volume);

    let mut restore_point_created = false;
    let mut restore_point_skipped_reason: Option<String> = None;
    let restore_desc = format!("PC Doctor: chkdsk /f öncesi {}:", volume);
    match restore_point::create(&restore_desc) {
        Ok(_) => restore_point_created = true,
        Err(e) => {
            restore_point_skipped_reason = Some(e.to_string());
            if !force_without_restore {
                return Err(format!("{RESTORE_FAILED}: {}", e));
            }
        }
    }

    if is_system {
        // System drive — schedule autochk via chkntfs /c, return scheduled status
        let mut result = chkdsk_remediation::schedule_system_fix(volume.clone())?;
        result.restore_point_created = restore_point_created;
        result.restore_point_skipped_reason = restore_point_skipped_reason;
        // Sprint 9 review H6 fix + Sprint 11 review H2 fix:
        // pending_state write fail → rollback. `cancel_session()` ScheduledFix variantında
        // chkntfs::cancel + reboot::abort yapar (failure-safe sıra). Double cancel ASLA;
        // sonucu yakalayıp kullanıcıya doğru durum bildir.
        if let Err(e) = pending_state::append(
            &app,
            PendingChkdsk {
                volume: volume.clone(),
                scheduled_at: chrono::Utc::now().to_rfc3339(),
                reboot_pending: false,
            },
        ) {
            let (schedule_cleared, _, _) = chkdsk_remediation::cancel_session();
            if !schedule_cleared {
                return Err(format!(
                    "{SCHEDULE_INCONSISTENT}: pending_state yazılamadı ({e}) ve chkntfs /x {volume}: rollback başarısız — manuel: chkntfs /x {volume}:"
                ));
            }
            return Err(format!(
                "{SCHEDULE_INCONSISTENT}: pending_state yazılamadı: {e}"
            ));
        }
        Ok(result)
    } else {
        // Non-system live /f
        let app2 = app.clone();
        let vol2 = volume.clone();
        let live_res =
            tauri::async_runtime::spawn_blocking(move || chkdsk_remediation::run_nonsystem_fix(app2, vol2))
                .await
                .map_err(|e| format!("Tarama görevi başarısız: {}", e))?;
        match live_res {
            Ok(mut r) => {
                r.restore_point_created = restore_point_created;
                r.restore_point_skipped_reason = restore_point_skipped_reason;
                Ok(r)
            }
            Err(e) => {
                // chkdsk exit 3 sıklıkla "Cannot lock current drive" — volume locked sentinel
                if e.to_lowercase().contains("lock") || e.to_lowercase().contains("dismount") {
                    Err(format!("{VOLUME_LOCKED}: {}", e))
                } else {
                    Err(e)
                }
            }
        }
    }
}

/// Cancel current chkdsk session (live kill veya scheduled rollback).
/// Admin gerekmez — kullanıcı kendi başlattığı işlemi durdurabilir.
///
/// Sprint 12 review H1+H3+H5 fix: pending_state::clear() YERINE remove(volume) —
/// multi-volume (Sprint 11 H6) invariantı ihlal etmiyor. Diğer pending volumes KORUNUR.
#[tauri::command]
pub fn cancel_chkdsk_session(app: tauri::AppHandle) -> ChkdskCancelOutcome {
    let (schedule_cleared, reboot_aborted, cancelled_volume) =
        chkdsk_remediation::cancel_session();
    if schedule_cleared {
        if let Some(v) = cancelled_volume.as_ref() {
            let _ = pending_state::remove(&app, v);
        }
    }
    ChkdskCancelOutcome {
        schedule_cleared,
        reboot_aborted,
    }
}

/// Countdown reboot. Admin gate (shutdown.exe /r system event).
#[tauri::command]
pub fn schedule_chkdsk_reboot(seconds: u32) -> Result<(), String> {
    if !admin::is_elevated() {
        return Err(format!(
            "{}: Reboot scheduling için yönetici yetkisi gerek.",
            NEEDS_ELEVATION
        ));
    }
    reboot::schedule_reboot(seconds)
}

/// shutdown /a — pending reboot abort. Admin gerekmez (defensive).
#[tauri::command]
pub fn abort_chkdsk_reboot() -> Result<bool, String> {
    reboot::abort_reboot()
}

/// pending_chkdsk.json read + chkntfs query crosscheck (ground-truth).
/// JSON var ama chkntfs "not dirty" diyorsa stale → silinir, None döner.
/// Sprint 11 H6: backward-compat shim — sadece ilk volume döner.
#[tauri::command]
pub fn query_pending_chkdsk(app: tauri::AppHandle) -> Option<PendingChkdsk> {
    let p = pending_state::read(&app)?;
    match chkntfs::query(&p.volume) {
        Ok(chkntfs::ChkntfsState::Scheduled) => Some(p),
        Ok(chkntfs::ChkntfsState::NotDirty) => {
            // Stale → bu volume'ü kaldır (multi-volume: diğerleri korunur)
            let _ = pending_state::remove(&app, &p.volume);
            None
        }
        _ => Some(p),
    }
}

/// Sprint 11 H6 — multi-volume aware: tüm pending volumes listesi.
/// Stale entry'ler (chkntfs NotDirty diyenler) listeden ÇIKARILIR.
#[tauri::command]
pub fn query_pending_chkdsks(app: tauri::AppHandle) -> Vec<PendingChkdsk> {
    let state = match pending_state::read_all(&app) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let mut out = Vec::new();
    for p in state.volumes {
        match chkntfs::query(&p.volume) {
            Ok(chkntfs::ChkntfsState::Scheduled) => out.push(p),
            Ok(chkntfs::ChkntfsState::NotDirty) => {
                // Stale — bu volume'ü temizle
                let _ = pending_state::remove(&app, &p.volume);
            }
            _ => out.push(p), // Unknown → JSON'a güven
        }
    }
    out
}

/// Bekleyen schedule'i iptal: chkntfs /x + shutdown /a + clear.
/// Sprint 9 review H8 fix: chkntfs /x fail durumunda pending_state.clear ATLANIR — registry
/// pending kalmışsa JSON'da da pending kalsın (split-brain önleme).
#[tauri::command]
pub fn cancel_pending_chkdsk(app: tauri::AppHandle, volume: String) -> Result<(), String> {
    vol_util::validate_volume(&volume)?;
    let chkntfs_ok = chkntfs::cancel(&volume).is_ok();
    let _ = reboot::abort_reboot();
    if chkntfs_ok {
        // Sprint 11 H6: yalnız bu volume'ü kaldır, diğer pending'leri koru
        let _ = pending_state::remove(&app, &volume);
        Ok(())
    } else {
        Err(format!(
            "{SCHEDULE_INCONSISTENT}: chkntfs /x {volume}: başarısız — manuel: chkntfs /x {volume}:"
        ))
    }
}

/// Wininit EventID 1001 fetch. Fail-soft.
#[tauri::command]
pub fn fetch_last_chkdsk_result(volume: String) -> Result<Option<ChkdskBootResult>, String> {
    vol_util::validate_volume(&volume)?;
    chkdsk_boot_result::fetch_last(&volume)
}

/// Sprint 10 review H3 + Sprint 11 review H3 fix: spawn_blocking + LIGHTWEIGHT letter listesi
/// (`list_fixed_ntfs_drive_letters` — yalnız Get-Volume, Event Log YOK). Eski `chkdsk_volumes::collect()`
/// 30-günlük Get-WinEvent çağırıyordu, app startup latency artırıyordu.
#[tauri::command]
pub async fn check_chkdsk_scheduled_volumes() -> Vec<String> {
    tauri::async_runtime::spawn_blocking(|| -> Vec<String> {
        let letters = chkdsk_volumes::list_fixed_ntfs_drive_letters();
        let mut out = Vec::new();
        for letter in letters {
            if let Ok(chkntfs::ChkntfsState::Scheduled) = chkntfs::query(&letter) {
                out.push(letter);
            }
        }
        out
    })
    .await
    .unwrap_or_default()
}

/// Sprint 6: SystemPropertiesPerformance.exe launcher.
/// Hardcoded path — SystemRoot env hijack'a karşı (security_config.rs:hosts pattern'iyle uyumlu).
/// UAC istemez (kullanıcı sonra Apply'da elevation alır).
#[tauri::command]
pub fn open_system_properties_performance() -> Result<(), String> {
    let exe = std::path::PathBuf::from(r"C:\Windows\System32\SystemPropertiesPerformance.exe");
    if !exe.exists() {
        return Err(format!("Bulunamadı: {}", exe.display()));
    }
    let mut cmd = std::process::Command::new(&exe);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("Çalıştırılamadı: {}", e))
}

#[tauri::command]
pub fn open_oem_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !is_allowed_url(&url) {
        return Err(format!("Bu URL allowlist'te yok: {}", url));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("Tarayıcı açılamadı: {}", e))
}

/// Exact-match allowlist: prefix değil tam eşleşme. Defense-in-depth.
fn is_allowed_url(url: &str) -> bool {
    if ALLOWED_SCHEME_URIS.contains(url) {
        return true;
    }
    // HTTPS: scheme + host parse + host allowlist
    if let Some(rest) = url.strip_prefix("https://") {
        // Path/query strip
        let host_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
        let host_with_port = &rest[..host_end];
        // Port strip
        let host = host_with_port.split(':').next().unwrap_or("");
        if !host.is_empty() && ALLOWED_HTTPS_HOSTS.contains(host) {
            return true;
        }
        // Google search fallback (?q=...) — driver finding'leri için
        if host == "www.google.com" && rest.contains("/search?") {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::{is_allowed_url, summarize_fix_all};
    use crate::models::FixItemResult;

    fn item(id: &str, ok: bool, reboot: bool) -> FixItemResult {
        FixItemResult {
            id: id.into(),
            ok,
            message_code: None,
            reboot_required: reboot,
        }
    }

    #[test]
    fn summarize_counts_applied_and_failed() {
        let out = summarize_fix_all(
            vec![item("a", true, false), item("b", false, false), item("c", true, false)],
            true,
            None,
        );
        assert_eq!(out.applied, 2);
        assert_eq!(out.failed, 1);
        assert!(out.restore_point_created);
        assert!(out.reboot_required.is_empty());
    }

    #[test]
    fn summarize_reboot_group_only_includes_successful_reboot_fixes() {
        // Başarılı + reboot → grupta; başarısız + reboot → grupta DEĞİL (uygulanmadı).
        let out = summarize_fix_all(
            vec![item("pagefile", true, true), item("chkdsk", false, true)],
            true,
            None,
        );
        assert_eq!(out.reboot_required, vec!["pagefile".to_string()]);
    }

    #[test]
    fn summarize_carries_restore_skip_reason() {
        let out = summarize_fix_all(vec![item("a", true, false)], false, Some("VSS kapalı".into()));
        assert!(!out.restore_point_created);
        assert_eq!(out.restore_point_skipped_reason.as_deref(), Some("VSS kapalı"));
    }

    #[test]
    fn allow_known_ms_settings() {
        assert!(is_allowed_url("ms-settings:windowsupdate"));
        assert!(is_allowed_url("ms-settings:deviceencryption"));
        assert!(is_allowed_url("windowsdefender://network"));
    }

    #[test]
    fn reject_unknown_ms_settings() {
        assert!(!is_allowed_url("ms-settings:developers"));
        assert!(!is_allowed_url("ms-settings:windowsupdate-action"));
    }

    #[test]
    fn allow_known_https() {
        assert!(is_allowed_url("https://www.nvidia.com/Download/index.aspx"));
        assert!(is_allowed_url("https://www.google.com/search?q=foo"));
    }

    #[test]
    fn reject_unknown_https_host() {
        assert!(!is_allowed_url("https://evil.example.com/"));
        assert!(!is_allowed_url("https://nvidia.com.evil.com/"));
    }
}
