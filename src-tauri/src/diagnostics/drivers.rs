//! Sürücüleri TOPLU (aggregate) Finding'e dönüştürür.
//!
//! Faz 2 kalibrasyon: eskiden her sürücü için ayrı bir Finding üretiliyordu (imzasız/eski →
//! Kritik). Tipik bir makinede 100+ eski/imzasız sürücü olduğundan bu yüzlerce "kritik"
//! gürültü yaratıyordu. Artık iki TOPLU bulgu: imzasız sayısı (Uyarı) + uzun süredir
//! güncellenmemiş sayısı (Bilgi). Aksiyon: Windows Update (sürücü güncellemelerinin kanalı).

use crate::models::{DriverInfo, Finding, FindingAction, MetricCode, Severity};
use serde_json::json;

pub const CATEGORY: &str = "Sürücü";
/// "uzun süredir güncellenmemiş" eşiği (gün) — 3 yıl. Eski sürücü tek başına sorun değildir;
/// yalnız toplu bir bilgi sinyali olarak gösterilir (kritik DEĞİL).
const OLD_DRIVER_DAYS: i64 = 1095;

pub fn evaluate(drivers: &[DriverInfo]) -> Vec<Finding> {
    let unsigned = drivers.iter().filter(|d| !d.is_signed).count() as u64;
    let old = drivers
        .iter()
        .filter(|d| d.is_signed && d.age_days >= OLD_DRIVER_DAYS)
        .count() as u64;

    let mut out = Vec::new();
    if unsigned > 0 {
        out.push(summary("unsigned_summary", Severity::Warning, unsigned));
    }
    if old > 0 {
        out.push(summary("outdated_summary", Severity::Info, old));
    }
    out
}

fn summary(code_id: &str, severity: Severity, count: u64) -> Finding {
    let mut f = Finding::code_only(
        format!("driver:{code_id}"),
        CATEGORY,
        severity,
        format!("finding.driver.{code_id}.title"),
        format!("finding.driver.{code_id}.description"),
    )
    .with_metric(count.to_string())
    .with_metric_code(MetricCode::Count { value: count })
    .with_params(json!({ "count": count }))
    .with_action(FindingAction::OpenUrl {
        url: "ms-settings:windowsupdate".into(),
    })
    .with_action_code(format!("finding.driver.{code_id}.action"));
    f.recommended_action = Some(
        "Windows Update > Gelişmiş seçenekler > İsteğe bağlı güncellemeler'den sürücüleri kontrol et."
            .into(),
    );
    f
}

#[cfg(test)]
mod tests {
    use super::*;

    fn drv(signed: bool, age_days: i64) -> DriverInfo {
        DriverInfo {
            device_name: "X".into(),
            manufacturer: "Y".into(),
            driver_version: "1".into(),
            driver_date: "2020".into(),
            is_signed: signed,
            class: "Net".into(),
            age_days,
        }
    }

    #[test]
    fn aggregates_unsigned_and_old_into_two_findings() {
        let drivers = vec![
            drv(false, 100),  // unsigned
            drv(false, 5000), // unsigned (age yok sayılır — imzasız sayılır)
            drv(true, 2000),  // old (>= 1095)
            drv(true, 1200),  // old
            drv(true, 200),   // taze — sayılmaz
        ];
        let f = evaluate(&drivers);
        assert_eq!(f.len(), 2);
        let unsigned = f.iter().find(|x| x.id == "driver:unsigned_summary").unwrap();
        assert!(matches!(unsigned.severity, Severity::Warning));
        assert_eq!(unsigned.params.as_ref().unwrap()["count"].as_u64(), Some(2));
        let old = f.iter().find(|x| x.id == "driver:outdated_summary").unwrap();
        assert!(matches!(old.severity, Severity::Info));
        assert_eq!(old.params.as_ref().unwrap()["count"].as_u64(), Some(2));
    }

    #[test]
    fn no_findings_when_all_fresh_and_signed() {
        let drivers = vec![drv(true, 100), drv(true, 500)];
        assert!(evaluate(&drivers).is_empty());
    }
}
