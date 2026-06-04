//! Pagefile + hibernation snapshot — Sprint 6.
//!
//! Tek PowerShell çağrısı: Win32_PageFileUsage + Win32_PageFileSetting
//! + Win32_ComputerSystem (RAM + AutomaticManagedPagefile) + powercfg /a
//! + hiberfil.sys size. PII-clean (sadece byte değerleri + bool/short string).

use crate::models::{PagefileEntry, PagefileSnapshot};
use crate::util::{powershell, system};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsPagefileSetting {
    name: Option<String>,
    initial_size: Option<u32>,
    maximum_size: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsPagefileUsage {
    allocated_base_size: Option<u32>,
    peak_usage: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PsComputerSystem {
    total_physical_memory_mb: Option<u64>,
    automatic_managed_pagefile: Option<bool>,
}

/// Sprint 11 D-ext — Win32_PhysicalMemory.Capacity ham toplam (DIMM raw).
/// Win32_ComputerSystem.TotalPhysicalMemory hipervizör/firmware reserve sonrası kullanılabilir
/// RAM olabilir; PhysicalMemory.Capacity sum'ı gerçek hardware kapasitesi.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PsPhysicalMemoryCapacity {
    capacity_mb: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PsPagefileBundle {
    settings: Vec<PsPagefileSetting>,
    usage: Option<PsPagefileUsage>,
    system: Option<PsComputerSystem>,
    /// Sprint 11 D-ext — Win32_PhysicalMemory.Capacity ham toplam (varsa öncelikli).
    physical_memory_total: Option<PsPhysicalMemoryCapacity>,
    hibernation_enabled: bool,
    hiberfil_mb: u64,
    system_drive_free_mb: u64,
    system_drive_total_mb: u64,
    system_drive_is_ssd: bool,
}

pub fn snapshot() -> Option<PagefileSnapshot> {
    // Hibernation enabled: registry HKLM\Power\HibernateEnabled (locale-bağımsız).
    // Disk match: $vol null-guard + Get-Partition→Get-Disk→Get-PhysicalDisk zinciri
    //   (-match regex injection bypass; security_config.rs:hosts pattern'iyle uyumlu).
    let script = r#"
        $ErrorActionPreference = 'SilentlyContinue'
        $sys = Get-CimInstance Win32_ComputerSystem |
            Select-Object @{N='TotalPhysicalMemoryMb';E={[math]::Floor($_.TotalPhysicalMemory/1MB)}}, AutomaticManagedPagefile
        $pfSet = @(Get-CimInstance Win32_PageFileSetting | Select-Object Name, InitialSize, MaximumSize)
        $pfUse = Get-CimInstance Win32_PageFileUsage |
            Select-Object @{N='AllocatedBaseSize';E={$_.AllocatedBaseSize}}, @{N='PeakUsage';E={$_.PeakUsage}} |
            Select-Object -First 1
        $hibProp = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power' -Name HibernateEnabled -ErrorAction SilentlyContinue
        $hibernationEnabled = [bool]($hibProp -and $hibProp.HibernateEnabled -eq 1)
        # Sprint 11 D-ext — Win32_PhysicalMemory.Capacity ham toplam (DIMM)
        $physMem = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue |
            Measure-Object -Property Capacity -Sum
        $physMemTotalMb = if ($physMem -and $physMem.Sum) { [math]::Floor($physMem.Sum/1MB) } else { 0 }
        $sysDrive = $env:SystemDrive.TrimEnd(':')
        $hiberPath = "$($sysDrive):\hiberfil.sys"
        $hiberMb = 0
        if (Test-Path -LiteralPath $hiberPath) {
            try { $hiberMb = [math]::Floor((Get-Item $hiberPath -Force).Length / 1MB) } catch { $hiberMb = 0 }
        }
        $vol = Get-Volume -DriveLetter $sysDrive -ErrorAction SilentlyContinue
        $freeMb = 0; $totalMb = 0
        if ($vol) {
            $freeMb = [math]::Floor($vol.SizeRemaining/1MB)
            $totalMb = [math]::Floor($vol.Size/1MB)
        }
        $isSsd = $false
        $disk = $null
        if ($vol) {
            $disk = Get-Partition -DriveLetter $sysDrive -ErrorAction SilentlyContinue |
                Get-Disk -ErrorAction SilentlyContinue |
                Get-PhysicalDisk -ErrorAction SilentlyContinue |
                Select-Object -First 1
        }
        if ($disk) { $isSsd = ($disk.MediaType -eq 'SSD' -or $disk.MediaType -eq 4) }

        [PSCustomObject]@{
            settings = $pfSet
            usage = $pfUse
            system = $sys
            physicalMemoryTotal = [PSCustomObject]@{ capacityMb = [int64]$physMemTotalMb }
            hibernationEnabled = $hibernationEnabled
            hiberfilMb = [int64]$hiberMb
            systemDriveFreeMb = [int64]$freeMb
            systemDriveTotalMb = [int64]$totalMb
            systemDriveIsSsd = $isSsd
        } | ConvertTo-Json -Compress -Depth 4
    "#;
    let raw = powershell::run_cim(script)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return None;
    }
    let bundle: PsPagefileBundle = serde_json::from_str(trimmed).ok()?;
    // Sprint 11 D-ext: Önce Win32_PhysicalMemory.Capacity ham toplamını dene (gerçek hardware
    // kapasitesi); yoksa Win32_ComputerSystem.TotalPhysicalMemory'ye düş.
    let total_ram_mb = bundle
        .physical_memory_total
        .as_ref()
        .and_then(|p| p.capacity_mb)
        .filter(|&v| v > 0)
        .or_else(|| bundle.system.as_ref().and_then(|s| s.total_physical_memory_mb))
        .unwrap_or(0);
    let automatic_managed = bundle
        .system
        .as_ref()
        .and_then(|s| s.automatic_managed_pagefile)
        .unwrap_or(true);
    let configured = bundle
        .settings
        .into_iter()
        .filter_map(|s| {
            Some(PagefileEntry {
                name: s.name.unwrap_or_default(),
                initial_size_mb: s.initial_size.unwrap_or(0),
                maximum_size_mb: s.maximum_size.unwrap_or(0),
            })
        })
        .collect();
    let (allocated_mb, peak_mb) = bundle
        .usage
        .map(|u| {
            (
                u.allocated_base_size.unwrap_or(0) as u64,
                u.peak_usage.unwrap_or(0) as u64,
            )
        })
        .unwrap_or((0, 0));
    Some(PagefileSnapshot {
        total_ram_mb,
        automatic_managed,
        configured,
        allocated_mb,
        peak_mb,
        hibernation_enabled: bundle.hibernation_enabled,
        hiberfil_mb: bundle.hiberfil_mb,
        system_drive_free_mb: bundle.system_drive_free_mb,
        system_drive_total_mb: bundle.system_drive_total_mb,
        is_laptop: system::is_laptop(),
        system_drive_is_ssd: bundle.system_drive_is_ssd,
    })
}
