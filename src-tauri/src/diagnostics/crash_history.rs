//! Crash history Finding üret — Sprint 7 i18n migration.
//! PII guard: top.source path içerebilir → normalize edilir.

use crate::diagnostics::util::{normalize_user_path, short_date, truncate_safe};
use crate::models::{CrashHistory, Finding, MetricCode, Severity};
use serde_json::json;

const CATEGORY: &str = "Çökme geçmişi";

pub fn evaluate(history: &CrashHistory) -> Vec<Finding> {
    let mut out = Vec::new();

    let wer = history.wer_count_30d;
    if wer >= 20 {
        let mut f = Finding::code_only(
            "crash:wer-many",
            CATEGORY,
            Severity::Critical,
            "finding.crash.wer_many.title",
            "finding.crash.wer_many.description",
        )
        .with_metric(wer.to_string())
        .with_metric_code(MetricCode::Count { value: wer as u64 })
        .with_params(json!({ "werCount": wer }));
        f.recommended_action = Some(
            "Reliability Monitor'da (Güvenilirlik Geçmişi) hangi uygulamaların çöktüğüne bak."
                .into(),
        );
        out.push(f);
    } else if wer >= 5 {
        let mut f = Finding::code_only(
            "crash:wer-some",
            CATEGORY,
            Severity::Warning,
            "finding.crash.wer_some.title",
            "finding.crash.wer_some.description",
        )
        .with_metric(wer.to_string())
        .with_metric_code(MetricCode::Count { value: wer as u64 })
        .with_params(json!({ "werCount": wer }));
        f.recommended_action =
            Some("Reliability Monitor üzerinden patternleri incele.".into());
        out.push(f);
    }

    if let Some(top) = history.reliability_signatures.first() {
        if top.count >= 10 {
            let severity = if top.count >= 30 {
                Severity::Critical
            } else {
                Severity::Warning
            };
            // PII: source dosya yolu içerebilir; normalize + truncate.
            let safe_source = truncate_safe(&normalize_user_path(&top.source), 60);
            let safe_last = short_date(&top.last_occurred);
            let mut f = Finding::code_only(
                format!("crash:top-{}", sanitize(&top.source)),
                CATEGORY,
                severity,
                "finding.crash.top_signature.title",
                "finding.crash.top_signature.description",
            )
            .with_metric(top.count.to_string())
            .with_metric_code(MetricCode::Count { value: top.count as u64 })
            .with_params(json!({
                "source": safe_source,
                "signatureCount": top.count,
                "lastOccurred": safe_last,
            }));
            f.recommended_action = Some(
                "Bu uygulamayı/servisi güncelle veya kaldır; sürücüye bağlıysa OEM sayfasını ziyaret et."
                    .into(),
            );
            out.push(f);
        }
    }

    out
}

fn sanitize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(40)
        .collect()
}
