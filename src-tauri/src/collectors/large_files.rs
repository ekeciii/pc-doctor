//! Sprint 14 — sürücü başına büyük + kullanılmayan dosya tarayıcısı.
//!
//! Bir sürücüyü walkdir ile gezer, korumalı (sistem/program) klasörleri atlar, yalnız
//! `CANDIDATE_FLOOR` üstü dosyaları toplar (milyonlarca küçük dosyayı görmezden gelir →
//! düşük bellek). Sonra iki liste türetir: en büyük dosyalar + uzun süredir erişilmemişler.

use crate::models::{DriveFileScan, LargeFile};
use crate::safety::protected;
use std::path::Path;
use std::time::SystemTime;
use walkdir::WalkDir;

/// Aday olarak toplanan minimum dosya boyutu (bunun altı hiç düşünülmez).
const CANDIDATE_FLOOR: u64 = 50 * 1024 * 1024; // 50 MB
/// Her listede gösterilen maksimum dosya sayısı.
const MAX_RESULTS: usize = 100;

struct Candidate {
    path: String,
    name: String,
    directory: String,
    size: u64,
    accessed_days: Option<i64>,
    modified_days: Option<i64>,
}

/// `drive` örn. "C:" veya "D:". `min_size_bytes` büyük-liste eşiği, `unused_days` kullanılmama eşiği.
pub fn scan_drive(drive: &str, min_size_bytes: u64, unused_days: i64) -> DriveFileScan {
    let root = format!("{}\\", drive.trim_end_matches('\\'));
    if !Path::new(&root).exists() {
        return DriveFileScan {
            drive: drive.to_string(),
            scanned_files: 0,
            skipped_dirs: 0,
            large_files: Vec::new(),
            unused_files: Vec::new(),
            error: Some("sürücü bulunamadı".into()),
        };
    }

    let now = SystemTime::now();
    let mut candidates: Vec<Candidate> = Vec::new();
    let mut scanned: u64 = 0;
    let mut skipped_dirs: u64 = 0;

    let walker = WalkDir::new(&root)
        .follow_links(false) // junction/symlink döngülerine girme
        .into_iter()
        .filter_entry(|e| {
            // Korumalı klasörleri (Windows, $Recycle.Bin…) komple atla.
            if e.file_type().is_dir() {
                if let Some(name) = e.file_name().to_str() {
                    if protected::skip_dir_name(name) {
                        return false;
                    }
                }
            }
            true
        });

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                skipped_dirs += 1; // erişim reddi vb. — sessizce atla
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        scanned += 1;
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        if size < CANDIDATE_FLOOR {
            continue;
        }
        let path = entry.path();
        // Nihai korumalı-dosya kontrolü (pagefile.sys gibi adlar).
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if protected::is_protected_file_name(name) {
                continue;
            }
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let directory = path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        candidates.push(Candidate {
            path: path.to_string_lossy().to_string(),
            name,
            directory,
            size,
            accessed_days: days_since(&meta.accessed().ok(), now),
            modified_days: days_since(&meta.modified().ok(), now),
        });
    }

    // Büyük dosyalar: min_size üstü, boyuta göre azalan, en fazla MAX_RESULTS.
    let mut large: Vec<&Candidate> = candidates
        .iter()
        .filter(|c| c.size >= min_size_bytes)
        .collect();
    large.sort_by_key(|c| std::cmp::Reverse(c.size));
    large.truncate(MAX_RESULTS);

    // Kullanılmayan: unused_days günden uzun erişilmemiş (last-access yoksa modified fallback).
    let mut unused: Vec<&Candidate> = candidates
        .iter()
        .filter(|c| {
            let idle = c.accessed_days.or(c.modified_days);
            matches!(idle, Some(d) if d >= unused_days)
        })
        .collect();
    unused.sort_by_key(|c| std::cmp::Reverse(c.size));
    unused.truncate(MAX_RESULTS);

    DriveFileScan {
        drive: drive.to_string(),
        scanned_files: scanned,
        skipped_dirs,
        large_files: large.into_iter().map(to_model).collect(),
        unused_files: unused.into_iter().map(to_model).collect(),
        error: None,
    }
}

fn to_model(c: &Candidate) -> LargeFile {
    LargeFile {
        path: c.path.clone(),
        name: c.name.clone(),
        directory: c.directory.clone(),
        size_bytes: c.size,
        last_accessed_days: c.accessed_days,
        last_modified_days: c.modified_days,
    }
}

fn days_since(t: &Option<SystemTime>, now: SystemTime) -> Option<i64> {
    let t = (*t)?;
    let elapsed = now.duration_since(t).ok()?;
    Some((elapsed.as_secs() / 86_400) as i64)
}
