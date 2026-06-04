//! SMART/disk sağlığı — Get-PhysicalDisk + Get-StorageReliabilityCounter.

use crate::models::SmartDisk;
use crate::util::powershell;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PhysDisk {
    friendly_name: Option<String>,
    media_type: Option<serde_json::Value>, // int or string varies
    health_status: Option<serde_json::Value>,
    operational_status: Option<serde_json::Value>,
    size: Option<u64>,
    bus_type: Option<serde_json::Value>,
    #[serde(rename = "DeviceId")]
    device_id: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Reliability {
    device_id: Option<serde_json::Value>,
    read_errors_total: Option<u64>,
    write_errors_total: Option<u64>,
    temperature: Option<i32>,
    wear: Option<u8>,
    power_on_hours: Option<u64>,
}

pub fn collect() -> Vec<SmartDisk> {
    let disks_json = match powershell::run_cim(
        "Get-PhysicalDisk -ErrorAction SilentlyContinue | \
         Select-Object FriendlyName, MediaType, HealthStatus, OperationalStatus, \
                       SerialNumber, Size, BusType, DeviceId | \
         ConvertTo-Json -Compress",
    ) {
        Some(s) if !s.trim().is_empty() => s,
        _ => return Vec::new(),
    };
    let disks: Vec<PhysDisk> = match parse_one_or_many(&disks_json) {
        Some(v) => v,
        None => return Vec::new(),
    };

    let reliability: Vec<Reliability> = match powershell::run_cim(
        "Get-PhysicalDisk -ErrorAction SilentlyContinue | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue | \
         Select-Object DeviceId, ReadErrorsTotal, WriteErrorsTotal, Temperature, Wear, PowerOnHours | \
         ConvertTo-Json -Compress",
    ) {
        Some(s) if !s.trim().is_empty() => parse_one_or_many(&s).unwrap_or_default(),
        _ => Vec::new(),
    };

    let mut rel_map: HashMap<String, Reliability> = HashMap::new();
    for r in reliability {
        if let Some(id) = &r.device_id {
            rel_map.insert(value_as_id(id), r);
        }
    }

    disks
        .into_iter()
        .filter_map(|d| {
            let friendly_name = d.friendly_name.unwrap_or_else(|| "(bilinmiyor)".into());
            let media_type = enum_label(d.media_type.as_ref(), &[(0, "Unknown"), (3, "HDD"), (4, "SSD"), (5, "SCM")]);
            let health_status = enum_label(d.health_status.as_ref(), &[(0, "Healthy"), (1, "Warning"), (2, "Unhealthy")]);
            let operational_status = match d.operational_status {
                Some(serde_json::Value::String(s)) => s,
                Some(serde_json::Value::Array(arr)) => arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
                    .join(", "),
                _ => "(bilinmiyor)".into(),
            };
            let bus_type = enum_label(
                d.bus_type.as_ref(),
                &[
                    (0, "Unknown"),
                    (1, "SCSI"),
                    (2, "ATAPI"),
                    (3, "ATA"),
                    (4, "1394"),
                    (5, "SSA"),
                    (6, "FibreChannel"),
                    (7, "USB"),
                    (8, "RAID"),
                    (9, "iSCSI"),
                    (10, "SAS"),
                    (11, "SATA"),
                    (12, "SD"),
                    (13, "MMC"),
                    (15, "FileBackedVirtual"),
                    (16, "StorageSpaces"),
                    (17, "NVMe"),
                    (18, "SCM"),
                    (19, "Ufs"),
                ],
            );
            let size_bytes = d.size.unwrap_or(0);
            let device_id_key = d.device_id.as_ref().map(value_as_id).unwrap_or_default();
            let rel = rel_map.get(&device_id_key);
            Some(SmartDisk {
                friendly_name,
                media_type,
                health_status,
                operational_status,
                size_bytes,
                bus_type,
                temperature_celsius: rel.and_then(|r| r.temperature),
                wear_percent: rel.and_then(|r| r.wear),
                read_errors_total: rel.and_then(|r| r.read_errors_total),
                write_errors_total: rel.and_then(|r| r.write_errors_total),
                power_on_hours: rel.and_then(|r| r.power_on_hours),
            })
        })
        .collect()
}

fn parse_one_or_many<T: serde::de::DeserializeOwned>(s: &str) -> Option<Vec<T>> {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Some(Vec::new());
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    match value {
        serde_json::Value::Array(arr) => Some(
            arr.into_iter()
                .filter_map(|v| serde_json::from_value(v).ok())
                .collect(),
        ),
        obj @ serde_json::Value::Object(_) => {
            serde_json::from_value(obj).ok().map(|item| vec![item])
        }
        _ => Some(Vec::new()),
    }
}

fn value_as_id(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

fn enum_label(v: Option<&serde_json::Value>, map: &[(u64, &str)]) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Number(n)) => {
            let id = n.as_u64().unwrap_or(0);
            map.iter()
                .find(|(k, _)| *k == id)
                .map(|(_, label)| (*label).to_string())
                .unwrap_or_else(|| format!("Code_{}", id))
        }
        _ => "(bilinmiyor)".into(),
    }
}

