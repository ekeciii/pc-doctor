//! Faz 2 — tek tık otomatik sistem düzeltmeleri (firewall / UAC / pagefile).
//!
//! Her fonksiyon: değişikliği uygular, sonra YENİ durumu DOĞRULAR ve yalnız doğrulanırsa
//! `Ok(())` döner. PowerShell üzerinden (codebase deseni). Admin gate çağıran `run_fix_all`'da.
//!
//! **Güvenlik invariantları** (tests/security_invariants.rs ile kuvvetlendirilir):
//! - Yalnız GÜVENLİĞİ ARTIRAN yön: firewall sadece AÇILIR (`-Enabled True`), asla kapatılmaz.
//! - UAC sadece AÇILIR (`EnableLUA = 1`), asla `0` yazılmaz.
//! - pagefile sadece sistem-yönetimliye ALINIR (`AutomaticManagedPagefile = $true`).

use std::time::Duration;

use crate::util::powershell;

fn verify(out: Option<String>) -> Result<(), String> {
    match out {
        Some(s) if s.contains("OK") => Ok(()),
        _ => Err("Düzeltme uygulanamadı veya doğrulanamadı.".into()),
    }
}

/// Kapalı tüm Windows Güvenlik Duvarı profillerini açar.
pub fn enable_firewall() -> Result<(), String> {
    let script = "Set-NetFirewallProfile -All -Enabled True; \
        $off = Get-NetFirewallProfile | Where-Object { -not $_.Enabled }; \
        if (-not $off) { 'OK' }";
    verify(powershell::run_with_timeout(script, Duration::from_secs(20)))
}

/// UAC'yi açar (EnableLUA = 1). Etkili olması için yeniden başlatma gerekir.
pub fn enable_uac() -> Result<(), String> {
    let key = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System";
    let script = format!(
        "Set-ItemProperty -Path '{key}' -Name 'EnableLUA' -Value 1 -Type DWord; \
         if ((Get-ItemProperty -Path '{key}' -Name 'EnableLUA').EnableLUA -eq 1) {{ 'OK' }}"
    );
    verify(powershell::run_with_timeout(&script, Duration::from_secs(15)))
}

/// Pagefile'ı sistem-yönetimliye alır. Etkili olması için yeniden başlatma gerekir.
pub fn set_pagefile_managed() -> Result<(), String> {
    let script = "$c = Get-WmiObject Win32_ComputerSystem; \
        $c.AutomaticManagedPagefile = $true; [void]$c.Put(); \
        if ((Get-WmiObject Win32_ComputerSystem).AutomaticManagedPagefile) { 'OK' }";
    verify(powershell::run_with_timeout(script, Duration::from_secs(20)))
}
