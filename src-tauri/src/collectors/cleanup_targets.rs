use crate::models::CleanupTarget;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub struct Candidate {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub reversible: bool,
    pub path_fn: fn() -> Option<PathBuf>,
}

pub const CANDIDATES: &[Candidate] = &[
    Candidate {
        id: "user-temp",
        label: "Kullanıcı geçici dosyaları (TEMP)",
        description: "Yüklemeler, kurulum sihirbazları ve uygulamaların bıraktığı geçici dosyalar.",
        reversible: false,
        path_fn: user_temp,
    },
    Candidate {
        id: "windows-temp",
        label: "Windows Temp",
        description: "C:\\Windows\\Temp altındaki sistem geçici dosyaları.",
        reversible: false,
        path_fn: windows_temp,
    },
    Candidate {
        id: "windows-update-cache",
        label: "Windows Update indirme önbelleği",
        description: "C:\\Windows\\SoftwareDistribution\\Download — indirilmiş ama artık gereksiz güncelleme paketleri.",
        reversible: false,
        path_fn: windows_update_cache,
    },
    Candidate {
        id: "cbs-logs",
        label: "Component-Based Servicing logları",
        description: "C:\\Windows\\Logs\\CBS — sfc/DISM çalıştırmaları sırasında üretilen büyük log dosyaları.",
        reversible: false,
        path_fn: cbs_logs,
    },
    Candidate {
        id: "winre-agent",
        label: "$WinREAgent kalıntısı",
        description: "Sürüm yükseltmesi sonrası geride kalan kurtarma ortamı kalıntı klasörü.",
        reversible: false,
        path_fn: winre_agent,
    },
    Candidate {
        id: "recycle-bin",
        label: "Geri Dönüşüm Kutusu",
        description: "Tüm sürücülerdeki silinmiş ama henüz boşaltılmamış dosyalar.",
        reversible: false,
        path_fn: recycle_bin_marker,
    },
];

fn user_temp() -> Option<PathBuf> {
    std::env::var_os("TEMP").map(PathBuf::from)
}

fn windows_temp() -> Option<PathBuf> {
    Some(windows_root().join("Temp"))
}

fn windows_update_cache() -> Option<PathBuf> {
    Some(windows_root().join("SoftwareDistribution").join("Download"))
}

fn cbs_logs() -> Option<PathBuf> {
    Some(windows_root().join("Logs").join("CBS"))
}

fn winre_agent() -> Option<PathBuf> {
    Some(system_drive_root().join("$WinREAgent"))
}

fn recycle_bin_marker() -> Option<PathBuf> {
    Some(system_drive_root().join("$Recycle.Bin"))
}

fn windows_root() -> PathBuf {
    std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("C:\\Windows"))
}

fn system_drive_root() -> PathBuf {
    std::env::var("SystemDrive")
        .map(|d| PathBuf::from(format!("{}\\", d)))
        .unwrap_or_else(|_| PathBuf::from("C:\\"))
}

pub fn measure(path: &Path) -> (u64, u64) {
    if !path.exists() {
        return (0, 0);
    }
    let mut bytes: u64 = 0;
    let mut count: u64 = 0;
    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                bytes = bytes.saturating_add(meta.len());
                count = count.saturating_add(1);
            }
        }
    }
    (bytes, count)
}

pub fn scan_all() -> Vec<CleanupTarget> {
    CANDIDATES
        .iter()
        .filter_map(|c| {
            let path = (c.path_fn)()?;
            let (bytes, items) = measure(&path);
            if bytes == 0 && items == 0 {
                return None;
            }
            Some(CleanupTarget {
                id: c.id.to_string(),
                label: c.label.to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: bytes,
                item_count: items,
                description: c.description.to_string(),
                reversible: c.reversible,
            })
        })
        .collect()
}
