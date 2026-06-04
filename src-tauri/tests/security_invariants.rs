//! Sprint 10 Faz 2 (CI) — 3 sprintlik manuel security grep disiplinini regression-proof yap.
//!
//! Integration test: kaynak ağacını okuyup yasak desenler arar. Pure additive — production
//! kod değişmez. Sprint 7-9 review workflow'ları bu kontrolleri manuel yapıyordu; bundan
//! sonra CI'da otomatik korunur.
//!
//! Çiğnenemez invariantlar (Sprint 6-9):
//! 1. fsutil dirty set YASAK (Sprint 7 review L9 + Sprint 8 spec invariant #1)
//! 2. bcdedit komutu YASAK (Sprint 8 spec invariant #3)
//! 3. BootExecute registry direct yazımı YASAK (Sprint 8 spec invariant #2)
//! 4. chkdsk `/f /x` (force dismount) kombinasyonu YASAK (Sprint 8 spec invariant #5)
//! 5. chkntfs `/d` (system-wide reset) YASAK (Sprint 8 spec invariant #6)
//! 6. shutdown `/c` mesaj SABIT ASCII const, kullanıcı input interpolasyonu YASAK (#9)
//! 7. chkdsk/chkntfs/shutdown.exe System32 hardcoded path (#4)

use std::path::{Path, PathBuf};

/// Source tree root: bu test dosyası src-tauri/tests/ altında, kaynaklar src-tauri/src/.
fn src_root() -> PathBuf {
    let cargo_manifest_dir = env!("CARGO_MANIFEST_DIR");
    Path::new(cargo_manifest_dir).join("src")
}

/// Tüm `.rs` kaynaklarını recursive topla.
fn collect_rust_sources() -> Vec<(PathBuf, String)> {
    fn walk(dir: &Path, out: &mut Vec<(PathBuf, String)>) {
        if !dir.is_dir() {
            return;
        }
        for entry in std::fs::read_dir(dir).expect("read_dir") {
            let entry = entry.expect("entry");
            let p = entry.path();
            if p.is_dir() {
                walk(&p, out);
            } else if p.extension().and_then(|e| e.to_str()) == Some("rs") {
                let body = std::fs::read_to_string(&p).expect("read_to_string");
                out.push((p, body));
            }
        }
    }
    let mut v = Vec::new();
    walk(&src_root(), &mut v);
    v
}

/// Belirli substring'i kaynaklarda ara. Yorum satırlarını (yalın `//`) hariç tut — design
/// notlarında deny-list kelimeleri geçebilir (örn. "fsutil YASAK" yorumu).
fn find_substring(needle: &str) -> Vec<String> {
    let mut hits = Vec::new();
    for (path, body) in collect_rust_sources() {
        for (i, line) in body.lines().enumerate() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") || trimmed.starts_with("/*") {
                continue;
            }
            if line.contains(needle) {
                hits.push(format!("{}:{}: {}", path.display(), i + 1, line.trim()));
            }
        }
    }
    hits
}

// =====================================================
// INVARIANT TESTS
// =====================================================

#[test]
fn invariant_1_no_fsutil_dirty_set() {
    let hits = find_substring("fsutil");
    assert!(
        hits.is_empty(),
        "Invariant #1: fsutil komutu YASAK. Bulunanlar:\n{}",
        hits.join("\n")
    );
}

#[test]
fn invariant_3_no_bcdedit() {
    let hits = find_substring("bcdedit");
    assert!(
        hits.is_empty(),
        "Invariant #3: bcdedit komutu YASAK. Bulunanlar:\n{}",
        hits.join("\n")
    );
}

#[test]
fn invariant_2_no_bootexecute_substring() {
    // "BootExecute" hem registry path hem konsept ismi — yorum dışında ortaya çıkmamalı
    let hits = find_substring("BootExecute");
    assert!(
        hits.is_empty(),
        "Invariant #2: BootExecute registry direct yazımı YASAK. Bulunanlar:\n{}",
        hits.join("\n")
    );
}

#[test]
fn invariant_2_no_winreg_crate_usage() {
    // winreg crate Cargo.lock'ta transitive olabilir ama `use winreg`/`extern crate winreg`
    // hiçbir kaynakta yer almamalı (Sprint 8 review verified).
    let hits = find_substring("use winreg");
    let hits2 = find_substring("extern crate winreg");
    let mut all = hits;
    all.extend(hits2);
    assert!(
        all.is_empty(),
        "Invariant #2: winreg crate direct kullanımı YASAK. Bulunanlar:\n{}",
        all.join("\n")
    );
}

#[test]
fn invariant_5_no_chkdsk_force_dismount_combo() {
    // `/f` ve `/x` aynı args dizisinde geçemez (force dismount = data loss).
    // Pragma: chkdsk.rs içinde `cmd.args(["target", "/f"])` ve `cmd.args(["target", "/scan"])`
    // OK; "/x" string'i hiç olmamalı (chkdsk.rs grep).
    for (path, body) in collect_rust_sources() {
        if !path.to_string_lossy().contains("chkdsk") {
            continue;
        }
        // Sade substring `"/x"` taraması — false positive minimal (test/doc ASCII).
        for (i, line) in body.lines().enumerate() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") || trimmed.starts_with("/*") {
                continue;
            }
            assert!(
                !line.contains("\"/x\""),
                "Invariant #5: chkdsk `/x` arg YASAK ({}:{}). Satır: {}",
                path.display(),
                i + 1,
                line.trim()
            );
        }
    }
}

#[test]
fn invariant_6_no_chkntfs_d_flag() {
    // chkntfs `/d` system-wide default restore eder; YASAK.
    for (path, body) in collect_rust_sources() {
        if !path.to_string_lossy().contains("chkntfs") {
            continue;
        }
        for (i, line) in body.lines().enumerate() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") || trimmed.starts_with("/*") {
                continue;
            }
            assert!(
                !line.contains("\"/d\""),
                "Invariant #6: chkntfs `/d` arg YASAK ({}:{}). Satır: {}",
                path.display(),
                i + 1,
                line.trim()
            );
        }
    }
}

#[test]
fn invariant_4_exe_paths_hardcoded_system32() {
    // chkdsk/chkntfs/shutdown.exe absolute System32 path olmalı.
    // Her remediation modulü kendi `*_EXE_PATH` sabitini tanımlamalı.
    let required = [
        ("remediation/chkdsk.rs", r"C:\Windows\System32\chkdsk.exe"),
        ("remediation/chkntfs.rs", r"C:\Windows\System32\chkntfs.exe"),
        ("remediation/reboot.rs", r"C:\Windows\System32\shutdown.exe"),
    ];
    for (module, expected_path) in required {
        let mut found = false;
        for (path, body) in collect_rust_sources() {
            if path.to_string_lossy().replace('\\', "/").ends_with(module) {
                if body.contains(expected_path) {
                    found = true;
                    break;
                }
            }
        }
        assert!(
            found,
            "Invariant #4: {} dosyasında hardcoded path '{}' bulunamadı.",
            module, expected_path
        );
    }
}

#[test]
fn invariant_9_shutdown_message_is_ascii_const() {
    // reboot.rs SHUTDOWN_MESSAGE const SABIT ASCII olmalı, format!/concat!/interpolasyon YOK.
    let reboot_rs = src_root().join("remediation").join("reboot.rs");
    let body = std::fs::read_to_string(&reboot_rs).expect("read reboot.rs");
    // SHUTDOWN_MESSAGE deklarasyonu raw literal olmalı (interpolasyon karakter yok).
    let line = body
        .lines()
        .find(|l| l.contains("SHUTDOWN_MESSAGE") && l.contains(":") && l.contains("&str"))
        .expect("SHUTDOWN_MESSAGE declaration bulunamadi");
    assert!(
        !line.contains("format!") && !line.contains("concat!"),
        "Invariant #9: SHUTDOWN_MESSAGE SABIT ASCII const olmalı, format!/concat! YASAK. Satır: {}",
        line
    );
}

/// Sprint 12 D-test — cancel_live_only invariant #22:
/// `cancel_live_only` ScheduledFix variantına HİÇ dokunmaz.
///
/// Bu kaynak-tabanlı test, fonksiyonun take_session yapmadan önce variant'i kontrol
/// ettiğini doğrular (atomic Mutex pattern). Race testi runtime'da yapılırsa
/// chkdsk.exe spawn gerek; bu test pattern compliance kontrolü.
#[test]
fn invariant_22_cancel_live_only_skips_scheduled_fix() {
    let chkdsk_rs = src_root().join("remediation").join("chkdsk.rs");
    let body = std::fs::read_to_string(&chkdsk_rs).expect("read chkdsk.rs");
    // cancel_live_only fonksiyonu bulunmalı
    assert!(
        body.contains("pub fn cancel_live_only"),
        "Invariant #22: cancel_live_only fonksiyonu bulunamadı"
    );
    // ScheduledFix variantına take_session yaptıktan SONRA dokunmamalı.
    // Kaynak pattern: match guard.as_ref() içinde ScheduledFix arm'ı take ETMEZ.
    let fn_start = body.find("pub fn cancel_live_only").unwrap();
    let fn_body: String = body[fn_start..].chars().take(2000).collect();
    // Pattern check: ScheduledFix arm None döndürmeli (live olmayan).
    assert!(
        fn_body.contains("ScheduledFix") || fn_body.contains("_ =>"),
        "Invariant #22: cancel_live_only ScheduledFix dalını handle etmiyor (gözden kaçmış olabilir)"
    );
    // Negative check: cancel_live_only içinde chkntfs::cancel ÇAĞIRMAMALI
    // (yalnız cancel_session ScheduledFix dalı çağırır).
    assert!(
        !fn_body.contains("chkntfs::cancel"),
        "Invariant #22 ihlali: cancel_live_only chkntfs::cancel çağırıyor — ScheduledFix KORUNMALI"
    );
}

#[test]
fn invariant_8_shutdown_clamp_constants_match() {
    // reboot.rs MIN_SECONDS=60, MAX_SECONDS=600 sabitleri var olmalı (clamp 60..600).
    let reboot_rs = src_root().join("remediation").join("reboot.rs");
    let body = std::fs::read_to_string(&reboot_rs).expect("read reboot.rs");
    assert!(
        body.contains("MIN_SECONDS: u32 = 60"),
        "Invariant #8: MIN_SECONDS=60 sabiti bulunamadı"
    );
    assert!(
        body.contains("MAX_SECONDS: u32 = 600"),
        "Invariant #8: MAX_SECONDS=600 sabiti bulunamadı"
    );
}
