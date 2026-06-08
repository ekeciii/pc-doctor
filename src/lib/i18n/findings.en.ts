// Finding code dictionary (EN) — Sprint 7 complete migration.
// Typed against `FindingCode` so any missing key is a compile error.

import type { FindingCode } from "./findings.tr";

export const findingsEn: Record<FindingCode, string> = {
  // === Pagefile ===
  "finding.pagefile.undersized.title": "Virtual memory (pagefile) is undersized",
  "finding.pagefile.undersized.description":
    "Manually configured pagefile ({configuredMb} MB) is below the recommended 1.5×RAM ({ramMb} MB) threshold of at least {recommendedMb} MB. Large applications may report 'out of memory'.",
  "finding.pagefile.undersized.action": "Set system-managed",
  "finding.pagefile.consider_managed.title": "Let the system manage virtual memory",
  "finding.pagefile.consider_managed.description":
    "You have {ramGb} GB of RAM and the pagefile is set manually. At this RAM size, leaving it to the system is more practical for both performance and disk usage.",
  "finding.pagefile.consider_managed.action": "Set system-managed",
  "finding.pagefile.high_usage.title": "Pagefile at high usage ({usagePercent}%)",
  "finding.pagefile.high_usage.description":
    "Pagefile peak usage reached {usagePercent}% of allocated space ({peakMb} MB / {allocatedMb} MB). This may indicate constant swapping — consider more RAM or a larger pagefile.",
  "finding.pagefile.high_usage.action": "Open Virtual Memory Settings",
  "finding.pagefile.hibernation_disk_pressure.title": "Hibernation is taking up disk space",
  "finding.pagefile.hibernation_disk_pressure.description":
    "System drive has only {freePercent}% free. hiberfil.sys uses {hiberfilMb} MB (≈ {ramMb} MB RAM). On a desktop that rarely hibernates, disabling can reclaim space.",
  "finding.pagefile.hibernation_disk_pressure.action": "Copy command",

  // === chkdsk ===
  "finding.chkdsk.errors_detected.title":
    "{errorCount} disk/NTFS errors detected on this system in the last 30 days",
  "finding.chkdsk.errors_detected.description":
    "The event log recorded {errorCount} errors from disk or NTFS drivers. Suggested first scan target: {volume}: drive. A chkdsk /scan can verify the file system and may reduce freezes. This is read-only — no repairs, no risk to your data.",
  "finding.chkdsk.errors_detected.action": "Start chkdsk Scan",

  // === disk_full ===
  "finding.disk_full.full.title": "{mount} drive is full ({freePercent}% free)",
  "finding.disk_full.full.description":
    "The drive is nearly full. System performance may degrade; updates may fail to install. Remaining: {freeFormatted}.",
  "finding.disk_full.warning.title": "{mount} drive is running low ({freePercent}% free)",
  "finding.disk_full.warning.description":
    "Disk is approaching the full threshold. Remaining: {freeFormatted}.",
  "finding.disk_full.info.title": "{mount} drive needs some breathing room ({freePercent}% free)",
  "finding.disk_full.info.description":
    "Not critical yet, but space is tight for large updates/games. Remaining: {freeFormatted}.",

  // === drivers === (Phase 2 calibration: aggregated, no per-driver noise)
  "finding.driver.unsigned_summary.title": "{count} unsigned drivers",
  "finding.driver.unsigned_summary.description":
    "These drivers' digital signature could not be verified. Check for trusted versions via Windows Update.",
  "finding.driver.unsigned_summary.action": "Open Windows Update",
  "finding.driver.outdated_summary.title": "{count} drivers not updated in a long time",
  "finding.driver.outdated_summary.description":
    "Drivers untouched for 3+ years. Usually harmless; you can check Windows Update for newer versions.",
  "finding.driver.outdated_summary.action": "Open Windows Update",
  // cleanup (Phase 2 — junk is a health signal; cleaning raises the score)
  "finding.cleanup.reclaimable.title": "Accumulated temporary files",
  "finding.cleanup.reclaimable.description":
    "{sizeGb} GB of temp/cache files have piled up. Clean them to improve disk health.",

  // === defender ===
  "finding.defender.active_threats.title":
    "{threatCount} active threats detected by Defender",
  "finding.defender.active_threats.description":
    "There are active or unblocked threats detected. Run a quick scan.",
  "finding.defender.active_threats.action": "Run Quick Scan",
  "finding.defender.rt_off.title": "Defender real-time protection is OFF",
  "finding.defender.rt_off.description":
    "Microsoft Defender real-time protection is disabled. Your PC is exposed to malware.",
  "finding.defender.rt_off.action": "Run Quick Scan",
  "finding.defender.av_off.title": "Antivirus is disabled",
  "finding.defender.av_off.description":
    "The Defender antivirus engine is off. If another AV is installed, check its status.",
  "finding.defender.tamper_off.title": "Defender tamper protection is OFF",
  "finding.defender.tamper_off.description":
    "Tamper Protection is disabled. Malware could alter Defender settings.",
  "finding.defender.tamper_off.action": "Open Windows Security",
  "finding.defender.sig_stale.title":
    "Defender signature database has not been updated for {ageDays} days",
  "finding.defender.sig_stale.description":
    "Signatures need to be up to date to catch new threats.",
  "finding.defender.sig_stale.action": "Open Windows Update",
  "finding.defender.scan_stale.title": "Last quick scan was {ageDays} days ago",
  "finding.defender.scan_stale.description":
    "Without regular scans, threats that slip past real-time protection can accumulate.",
  "finding.defender.scan_stale.action": "Run Quick Scan",

  // === smart ===
  "finding.smart.health.title": "{diskName} health warning: {healthStatus}",
  "finding.smart.health.description":
    "Operational status: {operationalStatus}. Back up your data and run the manufacturer's diagnostic tool.",
  "finding.smart.wear.title": "{diskName} SSD wear {wearPercent}%",
  "finding.smart.wear.description":
    "SSDs have a limited write lifespan. Values above 80% indicate the drive is nearing end of life.",
  "finding.smart.temperature.title": "{diskName} temperature is high: {temperatureC}°C",
  "finding.smart.temperature.description":
    "Sustained disk temperatures above 70°C shorten drive lifespan and increase the risk of data loss.",
  "finding.smart.io_errors.title": "{diskName} has accumulated I/O errors",
  "finding.smart.io_errors.description":
    "Total read errors: {readErrors}. Total write errors: {writeErrors}. The drive may be starting to fail.",

  // === thermal ===
  "finding.thermal.critical.title": "Hardware is critically hot: {maxTemp}°C",
  "finding.thermal.critical.description":
    "The ACPI thermal sensor ({zoneCount} zones) measured {maxTempPrecise}°C. At this level, CPU/GPU thermal throttling and reduced hardware lifespan are unavoidable. Note: sensor placement varies by OEM.",
  "finding.thermal.warning.title": "Hardware temperature is high: {maxTemp}°C",
  "finding.thermal.warning.description":
    "The ACPI thermal sensor ({zoneCount} zones) measured {maxTempPrecise}°C. If it rises further under load, throttling will kick in.",
  "finding.thermal.throttling_critical.title":
    "Severe CPU throttling: only {perfPercent}% of nominal speed",
  "finding.thermal.throttling_critical.description":
    "The CPU is under {loadPercent}% load but is only running at {perfPercent}% of its base speed. Excessive heat, power limits, or a restrictive BIOS profile may be the cause.",
  "finding.thermal.throttling_critical.action": "Open power settings",
  "finding.thermal.throttling_warning.title":
    "Mild CPU throttling: {perfPercent}% of nominal",
  "finding.thermal.throttling_warning.description":
    "Load is {loadPercent}% and performance is {perfPercent}% — below base speed. Thermal or power limits may be the cause.",
  "finding.thermal.throttling_warning.action": "Open power settings",

  // === security_config ===
  "finding.security.firewall_query_failed.title": "Windows Firewall status could not be read",
  "finding.security.firewall_query_failed.description":
    "Get-NetFirewallProfile did not respond. The MpsSvc service may be stopped or WMI may be broken.",
  "finding.security.firewall_third_party.title":
    "{vendor} firewall is active (Windows profiles off — normal)",
  "finding.security.firewall_third_party.description":
    "According to Windows Security Center, {vendor} firewall is active and up to date. That is why Windows Defender Firewall profiles ({profiles}) are off. If you use a third-party security suite, this is expected behavior.",
  "finding.security.firewall_off.title": "Windows Firewall is off ({profiles})",
  "finding.security.firewall_off.description":
    "At least one Windows Defender Firewall profile is off and no active third-party firewall was detected. A network attack defense layer is missing.",
  "finding.security.firewall_off.action": "Turn on firewall",
  "finding.security.uac_off.title": "User Account Control (UAC) is OFF",
  "finding.security.uac_off.description":
    "UAC is disabled. Malware can run administrative actions without prompting.",
  "finding.security.uac_off.action": "Turn on UAC",
  "finding.security.uac_no_prompt.title": "UAC never prompts administrators",
  "finding.security.uac_no_prompt.description":
    "ConsentPromptBehaviorAdmin=0 — administrator accounts never see a prompt when elevating. UAC is on but not effective.",
  "finding.security.bitlocker_off.title": "System drive is not encrypted (BitLocker off)",
  "finding.security.bitlocker_off.description":
    "If the laptop is lost or stolen, files on the C: drive can be read because they are unencrypted. Use BitLocker on Pro/Enterprise or Device Encryption on Home.",
  "finding.security.bitlocker_off.action": "Open Device Encryption",
  "finding.security.dns_unknown.title": "{unknownCount} unknown DNS servers",
  "finding.security.dns_unknown.description":
    "Some of your DNS servers are outside the standard public DNS list. This may be a corporate/ISP DNS (normal) or DNS hijacking by malware. Verify from network settings.",
  "finding.security.dns_unknown.action": "Open network settings",
  "finding.security.hosts_suspicious.title": "{suspiciousCount} custom entries in hosts file",
  "finding.security.hosts_suspicious.description":
    "Non-loopback lines were found. This may be an ad blocker or malicious DNS hijack. Review unfamiliar lines in C:\\Windows\\System32\\drivers\\etc\\hosts.",

  // === updates ===
  "finding.updates.wu_security.title": "{count} critical security updates pending",
  "finding.updates.wu_security.description":
    "There are pending records flagged by Microsoft as security updates.",
  "finding.updates.wu_security.action": "Open Windows Update",
  "finding.updates.wu_many.title": "{count} Windows updates pending",
  "finding.updates.wu_many.description":
    "Accumulated updates are preventing your system from staying stable and secure.",
  "finding.updates.wu_many.action": "Open Windows Update",
  "finding.updates.wu_some.title": "{count} updates available",
  "finding.updates.wu_some.description":
    "Not urgent, but we recommend installing them to stay up to date.",
  "finding.updates.wu_some.action": "Open Windows Update",
  "finding.updates.winget.title": "{count} apps can be updated (winget)",
  "finding.updates.winget.description":
    "Newer versions of your installed applications are available.",

  // === startup ===
  "finding.startup.slow_critical.title": "Last boot took too long: {seconds} seconds",
  "finding.startup.slow_critical.description":
    "Microsoft diagnostics reported {milliseconds} ms ({seconds}s) for the last boot. A startup longer than 2 minutes indicates a clear problem.",
  "finding.startup.slow_critical.action": "Open startup apps",
  "finding.startup.slow_warning.title": "Slow startup: {seconds} seconds",
  "finding.startup.slow_warning.description":
    "Last boot duration was {milliseconds} ms ({seconds}s). Under 60 seconds is considered ideal.",
  "finding.startup.slow_warning.action": "Open startup apps",
  "finding.startup.too_many.title": "Too many startup items ({count})",
  "finding.startup.too_many.description":
    "The number of programs auto-running at Windows startup is high. This can slow down boot and overall system performance.",
  "finding.startup.too_many.action": "Open startup apps",

  // === crash_history ===
  "finding.crash.wer_many.title": "{werCount} application crashes in the last 30 days",
  "finding.crash.wer_many.description":
    "Windows Error Reporting has logged many crash/hang events. If they cluster around a specific app, update or uninstall that application.",
  "finding.crash.wer_some.title": "{werCount} crash records in the last 30 days",
  "finding.crash.wer_some.description":
    "Recurring but low-volume crashes. A specific program or driver may be the cause.",
  "finding.crash.top_signature.title":
    "{signatureCount} reports from '{source}' (most frequent)",
  "finding.crash.top_signature.description":
    "Reliability Monitor recorded {signatureCount} reports from this source in the last 30 days. Last occurrence: {lastOccurred}.",

  // === event_log ===
  "finding.event_log.kernel_power_41.title":
    "Unexpected shutdown ({count} times in the last 7 days)",
  "finding.event_log.kernel_power_41.description":
    "Windows restarted unexpectedly after a hardware fault or power loss. System files may be corrupted.",
  "finding.event_log.kernel_power_41.action": "Repair system files",
  "finding.event_log.whea_or_bugcheck.title":
    "Hardware/BSOD signal: {provider} ({count})",
  "finding.event_log.whea_or_bugcheck.description":
    "Windows Hardware Error Architecture (WHEA) or BugCheck event detected. It may indicate a RAM/CPU/disk hardware issue or a driver fault.",
  "finding.event_log.whea_or_bugcheck.action": "Repair system files",
  "finding.event_log.gpu_driver_error.title": "GPU driver error ({count})",
  "finding.event_log.gpu_driver_error.description":
    "The {gpuVendor} provider logged {count} errors in the last 7 days. The GPU driver is likely outdated or corrupted.",
  "finding.event_log.gpu_driver_error.action": "Update GPU driver",
  "finding.event_log.disk_or_ntfs_error.title": "Disk/file system error ({count})",
  "finding.event_log.disk_or_ntfs_error.description":
    "NTFS or the disk driver logged errors. This may indicate bad sectors or a connection issue.",
  "finding.event_log.disk_or_ntfs_error.action": "Repair system files",
  "finding.event_log.application_crash.title": "Application crashes/hangs ({count})",
  "finding.event_log.application_crash.description":
    "Applications have been hanging or crashing frequently in the last 7 days. If a specific program is the culprit, update or uninstall it.",
};
