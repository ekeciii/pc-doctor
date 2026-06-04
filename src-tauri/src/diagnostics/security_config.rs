//! Güvenlik konfigi Finding'leri — Sprint 7 i18n migration.

use crate::models::{Finding, FindingAction, MetricCode, SecurityConfig, Severity};
use serde_json::json;

const CATEGORY: &str = "Güvenlik";

/// Bilinen güvenilir public DNS sunucuları. RFC1918 + loopback'i ayrı kontrol ediyoruz.
const KNOWN_PUBLIC_DNS: &[&str] = &[
    "8.8.8.8", "8.8.4.4",
    "1.1.1.1", "1.0.0.1",
    "1.1.1.2", "1.0.0.2",
    "1.1.1.3", "1.0.0.3",
    "9.9.9.9", "149.112.112.112",
    "9.9.9.10", "149.112.112.10",
    "9.9.9.11", "149.112.112.11",
    "208.67.222.222", "208.67.220.220",
    "208.67.222.123", "208.67.220.123",
    "94.140.14.14", "94.140.15.15",
    "94.140.14.15", "94.140.15.16",
    "77.88.8.8", "77.88.8.1",
    "77.88.8.88", "77.88.8.2",
    "77.88.8.7", "77.88.8.3",
    "185.228.168.9", "185.228.169.9",
    "8.26.56.26", "8.20.247.20",
    "4.2.2.1", "4.2.2.2", "4.2.2.3", "4.2.2.4",
    "76.76.2.0", "76.76.10.0",
];

pub fn evaluate(cfg: &SecurityConfig) -> Vec<Finding> {
    let mut out = Vec::new();

    // === Firewall ===
    match &cfg.firewall_profiles {
        None => {
            let mut f = Finding::code_only(
                "security:firewall-query-failed",
                CATEGORY,
                Severity::Critical,
                "finding.security.firewall_query_failed.title",
                "finding.security.firewall_query_failed.description",
            )
            .with_metric("?")
            .with_metric_code(MetricCode::BareString { text: "?".into() });
            f.recommended_action =
                Some("Yönetici PowerShell'de `Start-Service MpsSvc` çalıştır.".into());
            out.push(f);
        }
        Some(profiles) => {
            let disabled: Vec<&crate::models::FirewallProfile> =
                profiles.iter().filter(|p| !p.enabled).collect();
            if !disabled.is_empty() {
                let names = disabled
                    .iter()
                    .map(|p| p.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ");
                if let Some(vendor) = &cfg.third_party_firewall {
                    out.push(
                        Finding::code_only(
                            "security:firewall-third-party",
                            CATEGORY,
                            Severity::Info,
                            "finding.security.firewall_third_party.title",
                            "finding.security.firewall_third_party.description",
                        )
                        .with_metric(vendor.clone())
                        .with_metric_code(MetricCode::BareString {
                            text: vendor.clone(),
                        })
                        .with_params(json!({
                            "vendor": vendor.clone(),
                            "profiles": names,
                        })),
                    );
                } else {
                    let mut f = Finding::code_only(
                        "security:firewall-off",
                        CATEGORY,
                        Severity::Critical,
                        "finding.security.firewall_off.title",
                        "finding.security.firewall_off.description",
                    )
                    .with_metric(disabled.len().to_string())
                    .with_metric_code(MetricCode::Count { value: disabled.len() as u64 })
                    .with_action(FindingAction::EnableFirewall)
                    .with_action_code("finding.security.firewall_off.action")
                    .with_params(json!({
                        "profiles": names,
                    }));
                    f.recommended_action =
                        Some("Windows Güvenlik → Güvenlik Duvarı'ndan tüm profilleri aç.".into());
                    out.push(f);
                }
            }
        }
    }

    // === UAC ===
    if let Some(false) = cfg.uac_enabled {
        let mut f = Finding::code_only(
            "security:uac-off",
            CATEGORY,
            Severity::Critical,
            "finding.security.uac_off.title",
            "finding.security.uac_off.description",
        )
        .with_metric("!")
        .with_metric_code(MetricCode::BareString { text: "!".into() })
        .with_action(FindingAction::EnableUac)
        .with_action_code("finding.security.uac_off.action");
        f.recommended_action = Some(
            "Başlat menüsüne 'UAC' yaz ve 'Kullanıcı Hesabı Denetimi ayarlarını değiştir' sonucunu seç."
                .into(),
        );
        out.push(f);
    }
    if cfg.uac_consent_level == Some(0) && cfg.uac_enabled == Some(true) {
        let mut f = Finding::code_only(
            "security:uac-no-prompt",
            CATEGORY,
            Severity::Warning,
            "finding.security.uac_no_prompt.title",
            "finding.security.uac_no_prompt.description",
        )
        .with_metric("!")
        .with_metric_code(MetricCode::BareString { text: "!".into() });
        f.recommended_action =
            Some("Varsayılan UAC seviyesini geri al (ConsentPromptBehaviorAdmin=5).".into());
        out.push(f);
    }

    // === BitLocker (laptop için anlamlı) ===
    if cfg.is_laptop {
        if let Some(false) = cfg.bitlocker_c_protected {
            let mut f = Finding::code_only(
                "security:bitlocker-off",
                CATEGORY,
                Severity::Warning,
                "finding.security.bitlocker_off.title",
                "finding.security.bitlocker_off.description",
            )
            .with_metric("!")
            .with_metric_code(MetricCode::BareString { text: "!".into() })
            .with_action(FindingAction::OpenUrl {
                url: "ms-settings:deviceencryption".into(),
            })
            .with_action_code("finding.security.bitlocker_off.action");
            f.recommended_action = Some(
                "Sistem Ayarları → Cihaz şifrelemesi (Home) veya BitLocker (Pro) ile etkinleştir.".into(),
            );
            out.push(f);
        }
    }

    // === DNS ===
    // PII guard (Sprint 7 review C1/H2): DNS IP listesi ISP/coğrafi sızıntı yapabilir.
    // Sample params'a YAZILMAZ; UI runtime'da kullanıcıya gösterebilir ama DB'ye persist edilmez.
    let unknown_count = cfg
        .dns_servers
        .iter()
        .filter(|ip| !is_known_dns(ip))
        .count();
    if unknown_count > 0 {
        let mut f = Finding::code_only(
            "security:dns-unknown",
            CATEGORY,
            Severity::Info,
            "finding.security.dns_unknown.title",
            "finding.security.dns_unknown.description",
        )
        .with_metric(unknown_count.to_string())
        .with_metric_code(MetricCode::Count { value: unknown_count as u64 })
        .with_action(FindingAction::OpenUrl {
            url: "ms-settings:network-status".into(),
        })
        .with_action_code("finding.security.dns_unknown.action")
        .with_params(json!({
            "unknownCount": unknown_count,
        }));
        f.recommended_action = Some("Ağ ayarlarında DNS sunucularını gözden geçir.".into());
        out.push(f);
    }

    // === hosts ===
    // PII guard (Sprint 7 review C1): hosts satırı browsing/threat-model leak edebilir
    // (reklam/banka/sosyal medya engelleme bağlam ifşası). Sample asla params'a yazılmaz;
    // kullanıcı satırı manuel olarak hosts dosyasından okur.
    if !cfg.hosts_suspicious_lines.is_empty() {
        let suspicious_count = cfg.hosts_suspicious_lines.len();
        let severity = match suspicious_count {
            0 => return out,
            1..=4 => Severity::Info,
            5..=19 => Severity::Warning,
            _ => Severity::Critical,
        };
        let mut f = Finding::code_only(
            "security:hosts-suspicious",
            CATEGORY,
            severity,
            "finding.security.hosts_suspicious.title",
            "finding.security.hosts_suspicious.description",
        )
        .with_metric(suspicious_count.to_string())
        .with_metric_code(MetricCode::Count { value: suspicious_count as u64 })
        .with_params(json!({
            "suspiciousCount": suspicious_count,
        }));
        f.recommended_action = Some(
            "Tanımadığın satırları C:\\Windows\\System32\\drivers\\etc\\hosts'tan kaldır (Notepad'i yönetici olarak aç).".into(),
        );
        out.push(f);
    }

    out
}

fn is_known_dns(ip: &str) -> bool {
    if KNOWN_PUBLIC_DNS.contains(&ip) {
        return true;
    }
    is_local_ipv4(ip)
}

fn is_local_ipv4(ip: &str) -> bool {
    let addr: std::net::Ipv4Addr = match ip.parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let o = addr.octets();
    addr.is_loopback()
        || (o[0] == 10)
        || (o[0] == 172 && (16..=31).contains(&o[1]))
        || (o[0] == 192 && o[1] == 168)
        || (o[0] == 169 && o[1] == 254)
}
