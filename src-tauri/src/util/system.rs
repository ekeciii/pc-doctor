//! Sistem form factor (laptop/desktop) tespiti — tek source-of-truth,
//! process ömrü boyunca cache'lenir.
//!
//! Win32_SystemEnclosure.ChassisTypes DMTF spec'inde tanımlı:
//! - 8=Portable, 9=Laptop, 10=Notebook, 11=Handheld, 14=SubNotebook,
//!   30=Tablet, 31=Convertible, 32=Detachable
//! UPS bağlı masaüstünde Win32_Battery dolu olabilir → ChassisTypes önce.
//! ChassisTypes okunamazsa Win32_Battery fallback.

use crate::util::powershell;
use once_cell::sync::OnceCell;

static IS_LAPTOP: OnceCell<bool> = OnceCell::new();

pub fn is_laptop() -> bool {
    *IS_LAPTOP.get_or_init(detect_once)
}

fn detect_once() -> bool {
    // 1) ChassisTypes
    let script = "$c = (Get-CimInstance -ClassName Win32_SystemEnclosure -ErrorAction SilentlyContinue).ChassisTypes; \
                  if ($null -eq $c) { 'unknown'; return }; \
                  ($c | ForEach-Object { [int]$_ }) -join ','";
    if let Some(raw) = powershell::run_fast(script) {
        let s = raw.trim();
        if s != "unknown" && !s.is_empty() {
            let laptop_types: &[u32] = &[8, 9, 10, 11, 14, 30, 31, 32];
            let any_laptop = s
                .split(',')
                .filter_map(|t| t.trim().parse::<u32>().ok())
                .any(|t| laptop_types.contains(&t));
            return any_laptop;
        }
    }

    // 2) Win32_Battery fallback (UPS false positive riski var ama nadirdir)
    let battery_script = "@(Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue).Count -gt 0";
    match powershell::run_fast(battery_script) {
        Some(s) => s.trim().eq_ignore_ascii_case("True"),
        None => false,
    }
}

/// AC'de mi yoksa batarya gücünde mi? Laptop'larda anlamlı.
/// Win32_Battery.BatteryStatus: 1=Discharging (battery), 2=AC, 3=Fully charged AC, 4=Low battery, 5=Critical, ...
/// Kabaca: 2 veya 3 = AC, 1 veya 4 veya 5 = battery.
pub fn on_ac_power() -> Option<bool> {
    if !is_laptop() {
        return Some(true); // masaüstü her zaman "AC"
    }
    let script = "(Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | \
                  Select-Object -First 1).BatteryStatus";
    let raw = powershell::run_fast(script)?;
    let n: u32 = raw.trim().parse().ok()?;
    match n {
        2 | 3 | 6 | 7 | 8 | 9 => Some(true),  // AC variantları
        1 | 4 | 5 => Some(false),               // discharging variantları
        _ => None,
    }
}
