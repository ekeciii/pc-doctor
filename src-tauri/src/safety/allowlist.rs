use crate::models::AppError;
use std::path::{Component, Path, PathBuf};

/// Tüm temizleme yolları **mutlaka** bu kök listesinden birinin alt kümesi olmalı.
/// system32, Program Files, kullanıcı belgeleri vb. ASLA listeye eklenmez.
pub fn allowed_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    let windows_root = std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("C:\\Windows"));
    let system_drive = std::env::var("SystemDrive")
        .map(|d| PathBuf::from(format!("{}\\", d)))
        .unwrap_or_else(|_| PathBuf::from("C:\\"));

    if let Some(temp) = std::env::var_os("TEMP") {
        roots.push(PathBuf::from(temp));
    }
    roots.push(windows_root.join("Temp"));
    roots.push(windows_root.join("SoftwareDistribution").join("Download"));
    roots.push(windows_root.join("Logs").join("CBS"));
    roots.push(system_drive.join("$WinREAgent"));
    roots.push(system_drive.join("$Recycle.Bin"));
    roots
}

pub fn ensure_within_allowlist(path: &Path) -> Result<PathBuf, AppError> {
    let canonical = path
        .canonicalize()
        .or_else(|_| -> Result<PathBuf, std::io::Error> { Ok(normalize(path)) })?;
    for root in allowed_roots() {
        let normalized_root = root
            .canonicalize()
            .unwrap_or_else(|_| normalize(&root));
        if canonical.starts_with(&normalized_root) {
            return Ok(canonical);
        }
    }
    Err(AppError::ForbiddenPath(path.display().to_string()))
}

fn normalize(path: &Path) -> PathBuf {
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
