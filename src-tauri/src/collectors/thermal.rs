//! Donanım sıcaklığı + CPU throttling tespiti.
//!
//! - MSAcpi_ThermalZoneTemperature (root\wmi) → ACPI termal sensörleri (deciK).
//! - **Locale-neutral** processor performance + load: Get-Counter ad yolu Türkçe Windows'ta
//!   yok (lokalize), bu yüzden Win32_PerfFormattedData_Counters_ProcessorInformation
//!   CIM sınıfından okuyoruz (sınıf/property adları daima İngilizce).

use crate::models::ThermalSnapshot;
use crate::util::{powershell, system};

pub fn snapshot() -> ThermalSnapshot {
    let zones_celsius = collect_thermal_zones();
    let (perf, load) = collect_processor_perf_load();
    ThermalSnapshot {
        zones_celsius,
        processor_performance_percent_avg: perf,
        processor_load_percent_avg: load,
        is_laptop: system::is_laptop(),
        on_ac_power: system::on_ac_power(),
    }
}

fn collect_thermal_zones() -> Vec<f64> {
    let script = "Get-CimInstance -Namespace 'root\\wmi' -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | \
                  Select-Object -ExpandProperty CurrentTemperature | \
                  ConvertTo-Json -Compress";
    let raw = match powershell::run_cim(script) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Vec::new();
    }
    let value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let numbers: Vec<f64> = match value {
        serde_json::Value::Array(arr) => arr.iter().filter_map(|v| v.as_f64()).collect(),
        serde_json::Value::Number(n) => n.as_f64().into_iter().collect(),
        _ => Vec::new(),
    };
    numbers
        .into_iter()
        .map(|d| (d / 10.0) - 273.15)
        // Saçma değerler ve 0°C sentinel'ini at
        .filter(|c| c.is_finite() && *c > 0.5 && *c < 150.0)
        .collect()
}

/// CPU performansı (baz hıza göre %) ve load'u (utility %) eş zamanlı 3 örnek alır.
/// 3 örnek × 1 sn arayla → toplam ~3 sn. Locale-neutral sınıf adları.
fn collect_processor_perf_load() -> (Option<f64>, Option<f64>) {
    let script = "$perf=@(); $load=@(); \
                  1..3 | ForEach-Object { \
                    $s = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ProcessorInformation -Filter \"Name='_Total'\" -ErrorAction SilentlyContinue; \
                    if ($null -ne $s) { \
                      $perf += [double]$s.PercentProcessorPerformance; \
                      $load += [double]$s.PercentProcessorUtility; \
                    }; \
                    Start-Sleep -Seconds 1 \
                  }; \
                  if ($perf.Count -eq 0) { 'null'; return }; \
                  $p = ($perf | Measure-Object -Average).Average.ToString([System.Globalization.CultureInfo]::InvariantCulture); \
                  $l = ($load | Measure-Object -Average).Average.ToString([System.Globalization.CultureInfo]::InvariantCulture); \
                  \"$p|$l\"";
    let raw = match powershell::run_counter(script) {
        Some(s) => s,
        None => return (None, None),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return (None, None);
    }
    let mut parts = trimmed.split('|');
    let p = parts
        .next()
        .and_then(|s| s.replace(',', ".").parse::<f64>().ok())
        .filter(|v| v.is_finite() && *v >= 0.0 && *v <= 500.0);
    let l = parts
        .next()
        .and_then(|s| s.replace(',', ".").parse::<f64>().ok())
        .filter(|v| v.is_finite() && *v >= 0.0 && *v <= 500.0);
    (p, l)
}
