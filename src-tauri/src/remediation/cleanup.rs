use crate::collectors::cleanup_targets::{CANDIDATES, measure};
use crate::models::{AppError, CleanupTargetResult};
use crate::safety::allowlist;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn execute(target_ids: &[String]) -> Vec<CleanupTargetResult> {
    target_ids
        .iter()
        .map(|id| run_one(id))
        .collect()
}

fn run_one(id: &str) -> CleanupTargetResult {
    let Some(candidate) = CANDIDATES.iter().find(|c| c.id == id) else {
        return CleanupTargetResult {
            id: id.to_string(),
            label: id.to_string(),
            reclaimed_bytes: 0,
            items_removed: 0,
            items_skipped: 0,
            error: Some("bilinmeyen hedef".into()),
        };
    };

    let path = match (candidate.path_fn)() {
        Some(p) => p,
        None => {
            return CleanupTargetResult {
                id: id.to_string(),
                label: candidate.label.into(),
                reclaimed_bytes: 0,
                items_removed: 0,
                items_skipped: 0,
                error: Some("yol çözülemedi".into()),
            };
        }
    };

    // Recycle Bin: dosya silme yerine API'yi kullan.
    if id == "recycle-bin" {
        return clear_recycle_bin(candidate.label);
    }

    let (before, _) = measure(&path);

    // ASLA allowlist dışına çıkma.
    if let Err(e) = allowlist::ensure_within_allowlist(&path) {
        return CleanupTargetResult {
            id: id.to_string(),
            label: candidate.label.into(),
            reclaimed_bytes: 0,
            items_removed: 0,
            items_skipped: 0,
            error: Some(format!("güvenlik reddi: {e}")),
        };
    }

    let (removed, skipped) = delete_children(&path);
    let (after, _) = measure(&path);
    let reclaimed = before.saturating_sub(after);

    CleanupTargetResult {
        id: id.to_string(),
        label: candidate.label.into(),
        reclaimed_bytes: reclaimed,
        items_removed: removed,
        items_skipped: skipped,
        error: None,
    }
}

/// Yalnızca root'un DOĞRUDAN çocuklarını siler. Junction/symlink atlanır.
fn delete_children(root: &Path) -> (u64, u64) {
    let mut removed: u64 = 0;
    let mut skipped: u64 = 0;
    let read = match std::fs::read_dir(root) {
        Ok(r) => r,
        Err(_) => return (0, 0),
    };
    for entry in read.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        if file_type.is_symlink() {
            skipped += 1;
            continue;
        }
        let result = if file_type.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };
        match result {
            Ok(_) => removed += 1,
            Err(_) => skipped += 1, // kilitli dosya vb. — sessizce atla
        }
    }
    (removed, skipped)
}

fn clear_recycle_bin(label: &str) -> CleanupTargetResult {
    let script = "Clear-RecycleBin -Force -ErrorAction Stop";
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.output() {
        Ok(out) if out.status.success() => CleanupTargetResult {
            id: "recycle-bin".into(),
            label: label.into(),
            reclaimed_bytes: 0, // PowerShell çıktısı boyut vermiyor
            items_removed: 1,
            items_skipped: 0,
            error: None,
        },
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            CleanupTargetResult {
                id: "recycle-bin".into(),
                label: label.into(),
                reclaimed_bytes: 0,
                items_removed: 0,
                items_skipped: 0,
                error: Some(if stderr.is_empty() { "Clear-RecycleBin başarısız".into() } else { stderr }),
            }
        }
        Err(e) => CleanupTargetResult {
            id: "recycle-bin".into(),
            label: label.into(),
            reclaimed_bytes: 0,
            items_removed: 0,
            items_skipped: 0,
            error: Some(e.to_string()),
        },
    }
}

#[allow(dead_code)]
pub type _SilenceAppError = AppError;
