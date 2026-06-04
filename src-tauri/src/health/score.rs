//! Sağlık skoru modeli — saf fonksiyon, birim test edilebilir.
//!
//! Skor = `clamp(100 − Σ min(kategori_cezası, CATEGORY_CAP), 0..=100)`.
//! Ceza: Critical −25, Warning −8, Info −2, Good 0. Kategori başına tavan −30
//! (gürültülü tek bir kategori skoru tek başına yere seremez).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::models::{Finding, Severity};

const PENALTY_CRITICAL: u32 = 25;
const PENALTY_WARNING: u32 = 8;
const PENALTY_INFO: u32 = 2;
/// Tek bir kategorinin skordan götürebileceği en fazla puan.
const CATEGORY_CAP: u32 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScoreBand {
    #[default]
    Excellent, // 90-100
    Good,      // 70-89
    Warning,   // 40-69
    Critical,  // 0-39
}

/// Bir kategorinin skordan götürdüğü (tavan uygulanmış) puan. "Neden bu skor?" kırılımı için.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryPenalty {
    pub category: String,
    pub penalty: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthScore {
    pub score: u8,
    pub band: ScoreBand,
    /// i18n kodu; frontend `critical_count`/`warning_count` ile yerelleştirir.
    pub verdict_code: String,
    pub critical_count: u32,
    pub warning_count: u32,
    pub info_count: u32,
    /// Kategori başına götürülen puan, azalan sırada.
    pub breakdown: Vec<CategoryPenalty>,
}

impl Default for HealthScore {
    /// Bulgu yokken / deserialize fallback: kusursuz sağlık.
    fn default() -> Self {
        HealthScore {
            score: 100,
            band: ScoreBand::Excellent,
            verdict_code: "health.verdict.excellent".into(),
            critical_count: 0,
            warning_count: 0,
            info_count: 0,
            breakdown: Vec::new(),
        }
    }
}

fn severity_penalty(s: &Severity) -> u32 {
    match s {
        Severity::Critical => PENALTY_CRITICAL,
        Severity::Warning => PENALTY_WARNING,
        Severity::Info => PENALTY_INFO,
        Severity::Good => 0,
    }
}

fn band_for(score: u8) -> ScoreBand {
    match score {
        90..=100 => ScoreBand::Excellent,
        70..=89 => ScoreBand::Good,
        40..=69 => ScoreBand::Warning,
        _ => ScoreBand::Critical,
    }
}

fn verdict_for(critical: u32, warning: u32, score: u8) -> String {
    if critical > 0 {
        "health.verdict.critical".into()
    } else if warning > 0 {
        "health.verdict.warning".into()
    } else if score >= 90 {
        "health.verdict.excellent".into()
    } else {
        "health.verdict.good".into()
    }
}

/// Bulgulardan sağlık skorunu hesaplar. Saf fonksiyon.
pub fn compute_health(findings: &[Finding]) -> HealthScore {
    let mut per_category: BTreeMap<String, u32> = BTreeMap::new();
    let (mut critical, mut warning, mut info) = (0u32, 0u32, 0u32);

    for f in findings {
        let p = severity_penalty(&f.severity);
        if p > 0 {
            *per_category.entry(f.category.clone()).or_insert(0) += p;
        }
        match f.severity {
            Severity::Critical => critical += 1,
            Severity::Warning => warning += 1,
            Severity::Info => info += 1,
            Severity::Good => {}
        }
    }

    // Kategori başına tavan uygula, sıfır olanları ele.
    let mut breakdown: Vec<CategoryPenalty> = per_category
        .into_iter()
        .map(|(category, raw)| CategoryPenalty {
            category,
            penalty: raw.min(CATEGORY_CAP),
        })
        .filter(|c| c.penalty > 0)
        .collect();
    // Azalan ceza; eşitlikte kategori adına göre (deterministik).
    breakdown.sort_by(|a, b| b.penalty.cmp(&a.penalty).then_with(|| a.category.cmp(&b.category)));

    let total: u32 = breakdown.iter().map(|c| c.penalty).sum();
    let score = 100u32.saturating_sub(total).min(100) as u8;
    let band = band_for(score);
    let verdict_code = verdict_for(critical, warning, score);

    HealthScore {
        score,
        band,
        verdict_code,
        critical_count: critical,
        warning_count: warning,
        info_count: info,
        breakdown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Finding, Severity};

    fn finding(category: &str, severity: Severity) -> Finding {
        Finding::code_only(
            format!("{category}.x"),
            category,
            severity,
            "t.code",
            "d.code",
        )
    }

    #[test]
    fn empty_findings_yield_perfect_score() {
        let h = compute_health(&[]);
        assert_eq!(h.score, 100);
        assert_eq!(h.band, ScoreBand::Excellent);
        assert_eq!(h.verdict_code, "health.verdict.excellent");
        assert!(h.breakdown.is_empty());
    }

    #[test]
    fn good_findings_do_not_penalize() {
        let h = compute_health(&[finding("disk", Severity::Good), finding("smart", Severity::Good)]);
        assert_eq!(h.score, 100);
        assert!(h.breakdown.is_empty());
    }

    #[test]
    fn single_critical_costs_25() {
        let h = compute_health(&[finding("smart", Severity::Critical)]);
        assert_eq!(h.score, 75);
        assert_eq!(h.band, ScoreBand::Good); // 75 ∈ 70-89
        assert_eq!(h.critical_count, 1);
        assert_eq!(h.verdict_code, "health.verdict.critical");
        assert_eq!(h.breakdown.len(), 1);
        assert_eq!(h.breakdown[0].penalty, 25);
    }

    #[test]
    fn per_category_cap_limits_one_noisy_category() {
        // Aynı kategoride 2 kritik = 50 ham, ama tavan 30 → skor 70.
        let h = compute_health(&[
            finding("eventlog", Severity::Critical),
            finding("eventlog", Severity::Critical),
        ]);
        assert_eq!(h.breakdown[0].penalty, 30);
        assert_eq!(h.score, 70);
    }

    #[test]
    fn score_floors_at_zero() {
        // 5 kategori × tavan 30 = 150 > 100 → clamp 0.
        let findings: Vec<Finding> = ["a", "b", "c", "d", "e"]
            .iter()
            .flat_map(|c| {
                vec![
                    finding(c, Severity::Critical),
                    finding(c, Severity::Critical),
                ]
            })
            .collect();
        let h = compute_health(&findings);
        assert_eq!(h.score, 0);
        assert_eq!(h.band, ScoreBand::Critical);
    }

    #[test]
    fn mixed_severities_sum_across_categories_with_caps() {
        // disk: 1 warning (8), smart: 1 critical (25), updates: 3 info (6) → 39 → skor 61.
        let mut findings = vec![
            finding("disk", Severity::Warning),
            finding("smart", Severity::Critical),
        ];
        for _ in 0..3 {
            findings.push(finding("updates", Severity::Info));
        }
        let h = compute_health(&findings);
        assert_eq!(h.score, 61);
        assert_eq!(h.band, ScoreBand::Warning); // 61 ∈ 40-69
        assert_eq!(h.warning_count, 1);
        assert_eq!(h.critical_count, 1);
        assert_eq!(h.info_count, 3);
        // breakdown azalan: smart(25) > disk(8) > updates(6)
        assert_eq!(h.breakdown[0].category, "smart");
        assert_eq!(h.breakdown[0].penalty, 25);
    }

    #[test]
    fn warning_only_uses_warning_verdict() {
        let h = compute_health(&[finding("disk", Severity::Warning)]);
        assert_eq!(h.verdict_code, "health.verdict.warning");
        assert_eq!(h.score, 92);
        assert_eq!(h.band, ScoreBand::Excellent); // 92 ∈ 90-100
    }
}
