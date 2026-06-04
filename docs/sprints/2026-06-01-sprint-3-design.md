# Sprint 3 Tasarımı — Komple Tanı Motoru (7 modül, 3 faz)

**Tarih:** 2026-06-01
**Kapsam:** PC Doctor Sprint 3 — kapsamlı tanı motoru. Driver'dan virüse, donanım sıcaklığından güvenlik konfigine. **Hiçbir yeni özellik dosya silmez.**
**Önceki sprint:** Sprint 2 (Event Log + Drivers + sfc/DISM); Sprint 2b (AI) iptal edildi.

## Yön değişikliği

Önceki yol haritası AI'yı Sprint 2b'ye koymuştu. Kullanıcı kararı:
- **AI iptal** — Gemini/Ollama/Claude entegrasyonu yok. Tanılar TR sabit string + kural tabanlı yorumla.
- **Yeni odak: detection-first** — driver/virüs/donanım/yazılım hatasını **dosya silmeden** bul. Sprint 1 cleanup feature'ı korunur (opt-in), yeni özellikler okuma + tetikleyici tabanlı.

## Sprint 3 modülleri (7)

| # | Modül | Faz | Yeni komut/aksiyon | Etki |
|---|---|---|---|---|
| A | **Virüs + Defender** | 1 | Defender Quick Scan tetikle | Yüksek |
| B | **SMART disk sağlığı** | 1 | (yok, sadece tanı) | Çok yüksek |
| C | **Donanım sıcaklığı + throttling** | 2 | (yok, sadece tanı) | Yüksek |
| D | **Güvenlik konfig sanity** | 2 | `ms-settings:` deeplinks | Orta-yüksek |
| E | **Bekleyen güncellemeler** | 3 | `ms-settings:windowsupdate` | Orta |
| F | **Başlangıç performansı** | 3 | `ms-settings:startupapps` | Orta |
| G | **Donma/çökme geçmişi** | 3 | (yok, sadece tanı) | Orta |

Her faz: cargo check + npm build + smoke test. Faz arası kullanıcıya teslim, dönüş bekle.

## Mimari prensip (Sprint 1+2 paterni korunur)

- Tek `scan()` komutu, 7 yeni kolektör çağırır
- Her modül: `collectors/<mod>.rs` (veri çek) + `diagnostics/<mod>.rs` (Finding üret)
- `FindingAction` enum genişler: `RunDefenderQuickScan` eklenir, `OpenUrl` mevcut
- Defender Quick Scan SfcDism gibi streaming progress (Tauri event channel)
- Diğer modüllerde aksiyon = OpenUrl ile Settings deeplink

## Faz 1 — Virüs + SMART (en kritik 2)

### A. Virüs + Defender

**Backend (yeni dosyalar):**
- `collectors/defender.rs`
- `diagnostics/defender.rs`
- `remediation/defender_scan.rs` (DefenderScan streaming)

**Kolektör (PowerShell):**
```powershell
Get-MpComputerStatus | Select RealTimeProtectionEnabled, IsTamperProtected,
  AntispywareSignatureLastUpdated, AntivirusSignatureLastUpdated,
  AntivirusEnabled, BehaviorMonitorEnabled, FullScanAge, QuickScanAge,
  ComputerState | ConvertTo-Json -Compress
Get-MpThreatDetection | Select-Object ThreatID, ThreatName, ThreatStatusID,
  InitialDetectionTime, LastThreatStatusChangeTime, ProcessName, Resources |
  ConvertTo-Json -Compress -Depth 3
```

**Model:**
```rust
pub struct DefenderStatus {
    pub real_time_protection: bool,
    pub tamper_protection: bool,
    pub antivirus_enabled: bool,
    pub behavior_monitor: bool,
    pub last_quick_scan_days: Option<i64>,
    pub last_full_scan_days: Option<i64>,
    pub signature_age_days: Option<i64>,
}
pub struct ThreatDetection {
    pub threat_name: String,
    pub status: String,         // "Active", "Cleaned", "Quarantined"
    pub detected_at: String,
    pub process_name: Option<String>,
}
```

**Tanı kuralları:**
- `real_time_protection == false` → **Critical** (action: `RunDefenderQuickScan`)
- `tamper_protection == false` → Warning
- `signature_age_days > 7` → Warning
- `last_quick_scan_days > 14` → Warning (action: `RunDefenderQuickScan`)
- Active threat detection varsa → **Critical** (action: `RunDefenderQuickScan`)

**Defender Quick Scan akışı:**

Sfc'den daha basit — Defender'ın streaming output'u yok. İki seçenek:
1. `Start-MpScan -ScanType QuickScan` (synchronous, sonunda biter)
2. `Start-MpScan -ScanType QuickScan -AsJob` + periyodik `Get-MpScan` polling

İlki tercih: 5-15 dk sürer, exit code yeterli. UI'da "Tarama çalışıyor..." spinner + tamamlanınca `Get-MpThreatDetection` ile sonuç gösterilir.

**Yeni komut:**
```rust
#[tauri::command]
pub async fn run_defender_quick_scan(app: AppHandle) -> Result<ThreatScanResult, String> {
    // admin gerek (Start-MpScan elevation ister)
    // spawn_blocking → Start-MpScan -ScanType QuickScan
    // sonra Get-MpThreatDetection → ThreatScanResult
}
```

### B. SMART disk sağlığı

**Backend (yeni dosyalar):**
- `collectors/smart.rs`
- `diagnostics/smart.rs`

**Kolektör (PowerShell, çünkü MSStorageDriver_FailurePredictStatus root\\wmi namespace'inde wmi crate ile zor):**
```powershell
Get-PhysicalDisk | Select FriendlyName, MediaType, HealthStatus,
  OperationalStatus, SerialNumber, Size, BusType
Get-PhysicalDisk | Get-StorageReliabilityCounter | Select DeviceId,
  ReadErrorsTotal, WriteErrorsTotal, Temperature, Wear, StartStopCycleCount,
  PowerOnHours
```

**Model:**
```rust
pub struct SmartDisk {
    pub friendly_name: String,
    pub media_type: String,           // "SSD" | "HDD" | "Unknown"
    pub health_status: String,         // "Healthy" | "Warning" | "Unhealthy"
    pub operational_status: String,
    pub size_bytes: u64,
    pub bus_type: String,
    pub temperature_celsius: Option<i32>,
    pub wear_percent: Option<u8>,      // SSD için
    pub read_errors_total: Option<u64>,
    pub write_errors_total: Option<u64>,
    pub power_on_hours: Option<u64>,
}
```

**Tanı kuralları:**
- `health_status != "Healthy"` → **Critical**
- `wear_percent > 80` → Warning, `> 95` → Critical (SSD ömrü)
- `temperature_celsius > 60` → Warning, `> 70` → Critical
- `read_errors_total > 100` veya `write_errors_total > 100` → Critical
- `power_on_hours > 50000` + SSD → Info (uzun ömür)

**Aksiyon:** Yok (sadece bilgi). PRD: "ASLA driver kurma" → SSD firmware güncellemesi önerisi sade Finding metninde ("üretici sitesinden firmware kontrol et").

## Faz 2 — Sıcaklık + Güvenlik (2)

### C. Donanım sıcaklığı + throttling

**Backend:**
- `collectors/thermal.rs`
- `diagnostics/thermal.rs`

**Kolektör (WMI `root\\wmi` namespace — `wmi` crate desteklemiyor olabilir, PowerShell fallback):**
```powershell
# ACPI thermal zones (Kelvin / 10)
Get-CimInstance -Namespace 'root\wmi' -Class MSAcpi_ThermalZoneTemperature |
  Select InstanceName, CurrentTemperature
# CPU throttling
Get-Counter '\Processor Information(_Total)\% Processor Performance' -SampleInterval 1 -MaxSamples 3
```

**Model:**
```rust
pub struct ThermalReading {
    pub zone_name: String,         // örn. "ACPI\\ThermalZone\\TZ00_0"
    pub temperature_celsius: f64,
}
pub struct ThrottleReading {
    pub processor_performance_percent: f64,  // 100 = no throttle, < 100 = throttled
}
```

**Tanı kuralları:**
- Max thermal zone > 85°C → **Critical** (Finding: "CPU sıcaklığı kritik")
- Max thermal zone > 75°C → Warning
- Avg processor_performance_percent < 90 → Warning (thermal throttling)
- Avg < 70 → **Critical**

**Aksiyon:** Yok. Bilgi: "Soğutucu fanı temizle, termal macunu değiştir, fan eğrisini kontrol et."

### D. Güvenlik konfig sanity

**Backend:**
- `collectors/security_config.rs`
- `diagnostics/security_config.rs`

**Kolektör:**
```powershell
# Firewall
Get-NetFirewallProfile | Select Name, Enabled
# UAC
Get-ItemPropertyValue 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' EnableLUA
Get-ItemPropertyValue 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' ConsentPromptBehaviorAdmin
# BitLocker
Get-BitLockerVolume | Where-Object MountPoint -eq 'C:' | Select VolumeStatus, ProtectionStatus
# DNS
Get-DnsClientServerAddress -AddressFamily IPv4 | Where InterfaceAlias -notmatch 'Loopback'
# Hosts file
Get-Content 'C:\Windows\System32\drivers\etc\hosts'
```

**Model:**
```rust
pub struct SecurityConfig {
    pub firewall: Vec<(String, bool)>,    // profile name + enabled
    pub uac_enabled: bool,
    pub uac_consent_level: u32,           // 0=Never notify ... 5=Always
    pub bitlocker_c_protected: Option<bool>,
    pub dns_servers: Vec<String>,         // resolved IPv4 list
    pub hosts_entry_count: u32,
    pub hosts_suspicious_lines: Vec<String>,  // non-comment, non-loopback
}
```

**Tanı kuralları:**
- Herhangi firewall profile disabled → **Critical**
- `uac_enabled == false` → **Critical**
- `uac_consent_level == 0` → Warning (kullanıcı sorulmuyor)
- BitLocker C: korumasız + cihaz laptop → Warning (heuristic: pil var mı?)
- DNS Google/Cloudflare/ISP dışında bilinmeyen IP varsa → Warning (DNS hijacking riski)
- Hosts'ta 50+ entry veya bilinen ad blocker (Steven Black) dışı entry → Warning

**Aksiyon:** UAC için `ms-settings:notifications` (UAC ayarı oradan), Firewall için `windowsdefender://` deeplink.

## Faz 3 — Updates + Startup + Crash (3)

### E. Bekleyen güncellemeler

**Backend:**
- `collectors/updates.rs`
- `diagnostics/updates.rs`

**Kolektör:**
```powershell
# Windows Update via COM
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$result = $searcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0")
$result.Updates | Select Title, MsrcSeverity, IsMandatory, KBArticleIDs
# winget
winget upgrade --include-unknown --accept-source-agreements | ConvertFrom-Csv ...
```

**Model:**
```rust
pub struct PendingUpdate {
    pub source: String,        // "WindowsUpdate" | "winget"
    pub title: String,
    pub severity: Option<String>,
    pub is_security: bool,
}
```

**Tanı kuralları:**
- ≥1 Critical Microsoft güncellemesi → **Critical**
- Toplam pending ≥ 10 → Warning
- ≥1 winget upgrade → Info

**Aksiyon:** `ms-settings:windowsupdate`

### F. Başlangıç performansı

**Backend:**
- `collectors/startup.rs`
- `diagnostics/startup.rs`

**Kolektör:**
```powershell
# Boot time from Diagnostics-Performance
Get-WinEvent -LogName 'Microsoft-Windows-Diagnostics-Performance/Operational' -MaxEvents 50 |
  Where Id -eq 100 | Select TimeCreated, Message | Sort TimeCreated -Descending | Select -First 5
# Startup commands
Get-CimInstance Win32_StartupCommand | Select Name, Command, Location, User
```

**Model:**
```rust
pub struct StartupInfo {
    pub last_boot_duration_ms: Option<u64>,
    pub items: Vec<StartupItem>,
}
pub struct StartupItem {
    pub name: String,
    pub command: String,
    pub location: String,   // "HKLM\\...\\Run" vb.
    pub user: String,
}
```

**Tanı kuralları:**
- Boot > 60s → Warning, > 120s → Critical
- Startup item count ≥ 15 → Info ("Çok fazla başlangıç öğesi")
- Aksiyon: `ms-settings:startupapps`

### G. Donma/çökme geçmişi

**Backend:**
- `collectors/crash_history.rs`
- `diagnostics/crash_history.rs`

**Kolektör:**
```powershell
# WER reports last 30 days
Get-ChildItem 'C:\ProgramData\Microsoft\Windows\WER\ReportArchive','C:\ProgramData\Microsoft\Windows\WER\ReportQueue' -Directory -ErrorAction SilentlyContinue |
  Where LastWriteTime -gt (Get-Date).AddDays(-30) |
  Select Name, LastWriteTime
# Reliability records
Get-CimInstance Win32_ReliabilityRecords -Filter "TimeGenerated>'$(((Get-Date).AddDays(-30)).ToString('yyyyMMddHHmmss.ffffff+000'))'" |
  Group-Object SourceName | Select Name, Count
```

**Model:**
```rust
pub struct CrashSignature {
    pub source: String,           // örn. "Application Error", "BugCheck", "WerFault"
    pub count: u32,
    pub last_occurred: String,
}
```

**Tanı kuralları:**
- 5+ crash 7 günde → **Critical**
- 1-4 crash 30 günde → Warning
- Aksiyon: yok (zaten Sprint 2 sfc/DISM aksiyonu Event Log Finding'inden tetiklenebilir)

## Modeller, komutlar, capabilities güncellemeleri

### `models.rs` ek FindingAction variant'ı

```rust
pub enum FindingAction {
    RunSystemFileCheck,
    RunDefenderQuickScan,  // YENİ
    OpenUrl { url: String },
}
```

`OpenUrl` mevcut, `ms-settings:windowsupdate` vb. URL'leri da kabul etmeli. Capabilities'te `opener:allow-open-url` için pattern genişler:

```json
{ "identifier": "opener:allow-open-url", "allow": [
  { "url": "https://**" },
  { "url": "ms-settings:**" },
  { "url": "windowsdefender:**" }
]}
```

### Yeni komut

```rust
#[tauri::command]
pub async fn run_defender_quick_scan(app: AppHandle) -> Result<DefenderScanResult, String>
```

Yapı sfc'ye benzer ama streaming yok (Defender progress vermez). Sonunda summary döner.

### Genişleyen `scan` komutu

Sprint 2 sırasıyla: disk + event log + drivers + cleanup
Sprint 3 ekleyecek: defender + smart + thermal + security + updates + startup + crash

Toplam tarama süresi tahmini: 10-20s. Vergiyi azaltmak için PowerShell çağrılarını **paralel** çalıştırabiliriz (her biri ayrı `Command::spawn`). Sprint 3'te eklenir.

## Frontend (React)

### Faz 1 frontend

- `FindingCard`: `RunDefenderQuickScan` action ekle (kalkan + tara ikonu)
- `DefenderScanDialog.tsx` (yeni) — sfc'ye benzer ama streaming yok, sadece "Tarama çalışıyor..." spinner + sonuçta threat listesi
- `App.tsx`: defender state + dialog
- `i18n.ts`: Defender + SMART metinleri (~15 anahtar)

### Faz 2 frontend

- FindingCard değişiklik yok (yeni action yok)
- `i18n.ts`: Thermal + Security metinleri (~15 anahtar)
- Settings deeplinks için opener çağrısı (mevcut openOemLink genişletilebilir veya yeni `openSettings`)

### Faz 3 frontend

- `i18n.ts`: Updates + Startup + Crash metinleri (~10 anahtar)

## Cargo.toml ekleri

Hiç. Tüm yeni iş PowerShell sarmalayıcı + mevcut crate'ler (wmi'yi sadece B'de PowerShell yerine düşünebilirdik ama PowerShell daha hızlı setup).

> İleri optimizasyon: thermal/throttling perf counter'ları için `windows` crate `Win32_System_Performance` feature'ı eklenebilir. Sprint 3 için PowerShell yeterli.

## Güvenlik notları

- **Dosya silme YOK** — yeni hiçbir modül dosya sistemine yazmaz. Defender Scan Windows'un kendi process'i.
- **Aksiyonlar sadece**: (1) Defender Quick Scan tetikleyici, (2) Settings deeplink açma. Hiçbir aksiyon registry yazmaz, dosya silmez, driver yüklemez.
- **PowerShell injection**: tüm script'ler hardcoded — user input enjekte edilmiyor.
- **Tehdit isimleri**: `ThreatName` Defender'dan gelir; UI'da Finding metnine eklenirken `<` `>` `&` escape edilecek (React zaten escape eder, çift kontrol).
- **Capability genişletme**: `ms-settings:**` ve `windowsdefender:**` sadece app→OS native URL şemaları, web değil. Risk yok.

## Test stratejisi

### Faz sonu smoke (her faz için)

1. `cargo check` + `npm run build` temiz
2. `npm run tauri dev` (non-elevated) → pencere açılır
3. TARA → yeni Finding kategorisi(ler) görünür
4. Aksiyon butonu varsa: admin değilse NeedsElevation banner, admin ise akış başlar

### Sprint 3 sonu uçtan uca

5. Defender Quick Scan tetiklenir → dialog spinner → 5-15 dk sonra "0 tehdit bulundu" veya tehdit listesi
6. SMART Finding'i kritik SSD'de görünür
7. Sıcaklık Finding'i yüksek termal durumda görünür
8. Güvenlik konfig: firewall kapatınca Critical Finding gelir
9. ms-settings:windowsupdate deeplinki Settings uygulamasını açar
10. Disk doluluk + cleanup + Sprint 2/3 Finding'leri severity sırasında

### Adversarial review

Faz 3 bitince yeni Sprint 2 review pattern'i çalıştırılır (5 lens × find × adversarial verify).

## Bilinen kısıtlar (Sprint 3 sonu)

- Tarama süresi: 7 yeni modül + mevcut 4'le birlikte ilk tarama 15-25 sn alabilir. Paralelleştirme Sprint 4'te.
- Thermal sensörleri tüm donanımda yok — modern Intel/AMD CPU'larda var, eski sistemlerde boş döner. Finding üretilmez (graceful degradation).
- Get-PhysicalDisk eski Windows 10'larda eksik field'lar dönebilir.
- WER directory bazı policy'lerde devre dışıdır — boş liste döner.
- Reliability Monitor servisi disabled olabilir — Win32_ReliabilityRecords boş döner.

## Sprint 4 ve sonrası

- Code-signed MSI + auto-update (PRD Sprint 4)
- Tarama paralelleştirme + cancellation
- Geri al paneli (PRD Sprint 3'tü, Sprint 4'e kaydı)
- AI entegrasyonu **eğer kullanıcı geri isterse** (provider-agnostic mimari Sprint 4 freemium tier'ında değerli olabilir)
