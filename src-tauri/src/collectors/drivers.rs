//! WMI Win32_PnPSignedDriver ile imzalı sürücüleri listele.
//! DriverDate > 2 yıl veya imzasız olanları "outdated" döndür.

use crate::models::DriverInfo;
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use wmi::{COMLibrary, WMIConnection};

const OUTDATED_THRESHOLD_DAYS: i64 = 730; // 2 yıl

#[allow(non_camel_case_types)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Win32_PnPSignedDriver {
    #[serde(rename = "DeviceName")]
    device_name: Option<String>,
    #[serde(rename = "Manufacturer")]
    manufacturer: Option<String>,
    #[serde(rename = "DriverVersion")]
    driver_version: Option<String>,
    #[serde(rename = "DriverDate")]
    driver_date: Option<String>, // WMI datetime format: "20230515000000.000000-000"
    #[serde(rename = "IsSigned")]
    is_signed: Option<bool>,
    #[serde(rename = "DeviceClass")]
    device_class: Option<String>,
}

pub fn list_outdated_drivers() -> Vec<DriverInfo> {
    let com = match COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let wmi_conn = match WMIConnection::new(com) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let rows: Vec<Win32_PnPSignedDriver> = match wmi_conn.raw_query(
        "SELECT DeviceName, Manufacturer, DriverVersion, DriverDate, IsSigned, DeviceClass \
         FROM Win32_PnPSignedDriver WHERE DriverDate IS NOT NULL",
    ) {
        Ok(rows) => rows,
        Err(_) => return Vec::new(),
    };

    let today = Utc::now().date_naive();
    let mut out = Vec::new();
    for row in rows {
        let driver_date_raw = match row.driver_date.as_deref() {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };
        let date = match parse_wmi_date(driver_date_raw) {
            Some(d) => d,
            None => continue,
        };
        let age_days = (today - date).num_days();
        let is_signed = row.is_signed.unwrap_or(true);

        if age_days >= OUTDATED_THRESHOLD_DAYS || !is_signed {
            let device_name = row.device_name.unwrap_or_default();
            if device_name.is_empty() {
                continue;
            }
            out.push(DriverInfo {
                device_name,
                manufacturer: row.manufacturer.unwrap_or_default(),
                driver_version: row.driver_version.unwrap_or_default(),
                driver_date: date.to_string(),
                is_signed,
                class: row.device_class.unwrap_or_default(),
                age_days,
            });
        }
    }
    // En eski sürücüler önce
    out.sort_by(|a, b| b.age_days.cmp(&a.age_days));
    out
}

/// WMI datetime: `YYYYMMDDhhmmss.ffffff±UUU`
fn parse_wmi_date(s: &str) -> Option<NaiveDate> {
    if s.len() < 8 {
        return None;
    }
    let year: i32 = s.get(0..4)?.parse().ok()?;
    let month: u32 = s.get(4..6)?.parse().ok()?;
    let day: u32 = s.get(6..8)?.parse().ok()?;
    NaiveDate::from_ymd_opt(year, month, day)
}
