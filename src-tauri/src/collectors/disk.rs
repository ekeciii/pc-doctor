use crate::models::VolumeInfo;
use sysinfo::Disks;

pub fn list_volumes() -> Vec<VolumeInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .filter_map(|d| {
            let total = d.total_space();
            if total == 0 {
                return None;
            }
            let free = d.available_space();
            let used = total.saturating_sub(free);
            let used_percent = (used as f64 / total as f64) * 100.0;
            let mount = d.mount_point().to_string_lossy().to_string();
            let label = {
                let raw = d.name().to_string_lossy().to_string();
                if raw.is_empty() { None } else { Some(raw) }
            };
            let file_system = String::from_utf8_lossy(d.file_system().as_encoded_bytes()).to_string();
            Some(VolumeInfo {
                mount_point: mount,
                label,
                file_system,
                total_bytes: total,
                free_bytes: free,
                used_bytes: used,
                used_percent,
            })
        })
        .collect()
}
