# Sprint 2 Tasarımı — Event Log + Driver Inventory + sfc/DISM Onarımı

**Tarih:** 2026-06-01
**Kapsam:** PC Doctor Sprint 2 — Claude API entegrasyonu Sprint 2b'ye ertelendi.
**Önceki sprint:** Sprint 1 (Disk doluluk + güvenli temizlik + System Restore + Elevation system).

## Amaç

Sprint 1'in tek-tıkla TARA akışına üç yeni tanı katmanı eklemek:

1. **Olay günlüğü analizi** — Son 7 günde Windows Event Log'da sistem kararlılığını işaret eden hata olaylarını tespit etmek (Kernel-Power 41, BugCheck, nvlddmkm, disk, ntfs hataları). Tek başına çözüm üretmez; "donma sebebi bu olabilir" sinyali verir ve uygun bir remediation önerir.

2. **Driver inventory** — Bilgisayardaki imzalı sürücüleri listelemek, 2 yıldan eski olanları "potansiyel olarak eski" Finding'i olarak göstermek, kullanıcıyı OEM (NVIDIA, AMD, Intel, Realtek) indirme sayfasına yönlendirmek. Otomatik kurma YOK (PRD güvenlik kuralı).

3. **Sfc /scannow + DISM /RestoreHealth onarımı** — Olay günlüğünde sistem dosyası bozulmasına işaret eden patternlar (BugCheck, ntfs hataları, sürekli Kernel-Power 41) gözlemlenirse, bir Finding'in DÜZELT butonu sfc + DISM'i başlatır. UI'da streaming progress modal'ı.

## Tasarım dışı bırakılan

- **Claude API entegrasyonu** — Sprint 2b'ye ertelendi. Kolektörlerin temiz output'u olunca AI yorumlama katmanı üstüne oturur, riski izole edilir.
- **Windows Update COM API ile sürücü kontrol** — Çok karmaşık COM çağrıları, Sprint 3+ veya başka bir yaklaşım.
- **Manuel "sfc çalıştır" butonu** — Sadece otomatik öneri akışı. UI cluster'ı önlenir.
- **Tüm sürücülerin listesi** — Sadece flagged olanlar gösterilir.

## Mimari

### Tek TARA akışı (değişiklik YOK)

PRD'nin temel UX prensibi: tek TARA butonu, tüm bulgular tek raporda. Sprint 2 bu prensibi kırmaz. `scan` komutu yeni kolektörleri çağırır, hepsi `ScanReport.findings` listesine eklenir.

### Yeni `Finding.action` alanı

Mevcut `Finding` struct'ına opsiyonel `action: Option<FindingAction>` alanı eklenir. Bu, frontend'in finding'e karşılık doğru butonu render etmesini sağlar:

```rust
pub enum FindingAction {
    /// "DÜZELT" butonu sfc/DISM modal'ını açar
    RunSystemFileCheck,
    /// "OEM sitesine git" butonu tarayıcıyı açar
    OpenUrl(String),
}
```

Mevcut disk fullness Finding'leri için bu alan `None` kalır (cleanup akışı ayrı panel üzerinden); yeni Finding'ler bu alanı doldurur.

### Streaming sfc/DISM

sfc/DISM 15-30 dk sürer. Tauri'nin built-in event channel'ı kullanılır:

- Backend: `run_system_file_check` komutu spawn ediliyor, stdout/stderr line-by-line okunup `app.emit("sfc-progress", line)` ile yayınlanır
- Frontend: `SfcDismProgressDialog` modal'ı `listen("sfc-progress")` ile gelen satırları append eder, "Tamamlandı" event'inde özet gösterir

Komut başlangıçta `task_id: String` döner (sonradan iptal eklemek istersek lazım); Sprint 2'de iptal YOK.

## Backend (Rust)

### Yeni dosyalar

#### `src-tauri/src/collectors/event_log.rs`

PowerShell wrapper kullanır (windows-rs Win32_System_EventLog COM çağrıları karmaşık; PowerShell `Get-WinEvent` aynı işi yapar ve Sprint 1'de PowerShell sarmalayıcı paterni kuruldu — bkz. `safety/restore_point.rs`).

```rust
pub struct EventLogSignature {
    pub provider: String,
    pub event_id: u32,
    pub level: String,         // "Critical", "Error", "Warning"
    pub count: u32,
    pub first_occurred: String, // ISO 8601
    pub last_occurred: String,
    pub sample_message: String, // İlk olayın mesajı, kısaltılmış
}

pub fn scan_recent_critical() -> Vec<EventLogSignature> { ... }
```

PowerShell sorgusu:
```powershell
Get-WinEvent -FilterHashtable @{
  LogName = 'System','Application'
  ProviderName = 'Microsoft-Windows-Kernel-Power','Microsoft-Windows-WHEA-Logger',
                 'nvlddmkm','disk','Ntfs','Application Hang','Application Error'
  StartTime = (Get-Date).AddDays(-7)
  Level = 1,2,3  # Critical, Error, Warning
} | Group-Object ProviderName, Id | ForEach-Object { ... ConvertTo-Json }
```

Hata: provider yoksa veya log'da olay yoksa boş liste döner (hata değil).

#### `src-tauri/src/collectors/drivers.rs`

WMI ile `Win32_PnPSignedDriver` sınıfı sorgulanır. `wmi` crate (`crates.io/crates/wmi`) kullanılır — raw COM'a göre çok daha temiz.

```rust
pub struct DriverInfo {
    pub device_name: String,
    pub manufacturer: String,
    pub driver_version: String,
    pub driver_date: String,    // ISO 8601
    pub is_signed: bool,
    pub class: String,          // "Display", "Net", "DiskDrive", "SCSIAdapter", "System"
    pub age_days: i64,
}

pub fn list_outdated_drivers() -> Vec<DriverInfo> {
    // SELECT * FROM Win32_PnPSignedDriver WHERE DriverDate IS NOT NULL
    // filtre: age_days > 730 OR is_signed=false
}
```

#### `src-tauri/src/diagnostics/event_log.rs`

Signature'ları Finding'e dönüştürür ve uygun `action` atar:

```rust
pub fn evaluate(signatures: &[EventLogSignature]) -> Vec<Finding>
```

Kurallar:
- `BugCheck` (WHEA-Logger/Kernel-Power 41) > 2 olay → Severity::Critical + `action: RunSystemFileCheck`
- `nvlddmkm` > 5 olay → Severity::Warning + finding mesajında "GPU sürücü güncellemesi" notu (action: None, ilgili driver finding'de OEM linki var)
- `Ntfs` / `disk` Error > 3 olay → Severity::Critical + `action: RunSystemFileCheck`
- `Application Error` / `Application Hang` > 10 olay → Severity::Warning (action: None, sadece bilgi)

#### `src-tauri/src/diagnostics/drivers.rs`

```rust
pub fn evaluate(drivers: &[DriverInfo]) -> Vec<Finding>
```

Her flagged sürücü için bir Finding üretir. OEM link mapping:

```rust
fn oem_url(manufacturer: &str, class: &str) -> Option<String> {
    let m = manufacturer.to_lowercase();
    if m.contains("nvidia")     { Some("https://www.nvidia.com/Download/index.aspx".into()) }
    else if m.contains("amd") || m.contains("ati") { Some("https://www.amd.com/en/support".into()) }
    else if m.contains("intel") { Some("https://www.intel.com/content/www/us/en/support/detect.html".into()) }
    else if m.contains("realtek") { Some("https://www.realtek.com/en/downloads".into()) }
    else if m.contains("microsoft") { None } // Windows Update halleder
    else {
        // Fallback: Google arama
        let q = format!("{} {} driver download", manufacturer, class);
        Some(format!("https://www.google.com/search?q={}", urlencoding::encode(&q)))
    }
}
```

Severity: `age_days > 1095` (3 yıl) Critical, `730-1095` (2-3 yıl) Warning.

#### `src-tauri/src/remediation/system_file_check.rs`

```rust
pub async fn run(app: tauri::AppHandle) -> Result<SfcDismSummary, String>
```

İki aşama:
1. **DISM /Online /Cleanup-Image /RestoreHealth** — önce sistem image'ı onar (sfc'nin kullanacağı kaynak temiz olur)
2. **sfc /scannow** — sistem dosyalarını tara/onar

Her aşama bir `Command::new().stdout(Stdio::piped())` ile çalıştırılır, BufReader üzerinden satır satır okunur:

```rust
app.emit("sfc-dism-progress", ProgressLine {
    phase: "DISM" | "SFC",
    text: line,
    percent: parse_percent(&line),
})?;
```

Sonunda summary:
```rust
pub struct SfcDismSummary {
    pub dism_ok: bool,
    pub sfc_ok: bool,
    pub sfc_repaired_files: bool, // sfc çıktısında "Windows Resource Protection found corrupt files and successfully repaired them" var mı
    pub log_tail: String, // son 20 satır
}
```

### Değişen dosyalar

#### `src-tauri/src/models.rs`

```rust
// Mevcut Finding'e ekle:
#[derive(...)]
pub struct Finding {
    pub id: String,
    pub category: String,
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub metric: Option<String>,
    pub recommended_action: Option<String>,
    pub action: Option<FindingAction>,  // YENİ
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FindingAction {
    RunSystemFileCheck,
    OpenUrl { url: String },
}
```

#### `src-tauri/src/commands.rs`

`scan` komutuna iki yeni adım eklenir:

```rust
pub fn scan() -> ScanReport {
    let volumes = disk::list_volumes();
    let event_signatures = event_log::scan_recent_critical();
    let drivers = drivers::list_outdated_drivers();

    let mut findings = disk_full::evaluate(&volumes);
    findings.extend(event_log_diag::evaluate(&event_signatures));
    findings.extend(drivers_diag::evaluate(&drivers));

    let cleanup_targets = cleanup_targets::scan_all();
    let total_reclaimable_bytes = cleanup_targets.iter().map(|t| t.size_bytes).sum();
    // ...
}
```

Yeni komutlar:

```rust
#[tauri::command]
pub async fn run_system_file_check(app: tauri::AppHandle) -> Result<SfcDismSummary, String> {
    if !admin::is_elevated() {
        return Err(format!("{}: ...", NEEDS_ELEVATION));
    }
    system_file_check::run(app).await
}

#[tauri::command]
pub fn open_oem_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(&url, None).map_err(|e| e.to_string())
}
```

#### `src-tauri/Cargo.toml`

```toml
[dependencies]
# Mevcut...
tauri-plugin-shell = "2.0"
wmi = "0.13"
urlencoding = "2"
```

> `wmi` crate kendi COM init + binding'lerini yönetir → ek `windows` feature gerekmez.
> Event Log için PowerShell sarmalayıcı kullanıldığı için `Win32_System_EventLog` feature'ı YOK.

#### `src-tauri/src/lib.rs`

```rust
// Plugin kaydı
.plugin(tauri_plugin_shell::init())

// Yeni komutlar invoke_handler'a eklenir
```

#### `src-tauri/capabilities/default.json`

```json
{
  "permissions": [
    "core:default",
    "core:window:default",
    "core:event:default",
    "dialog:default",
    "shell:default",
    { "identifier": "shell:allow-open", "allow": [{ "url": "https://**" }] }
  ]
}
```

## Frontend (React)

### Yeni dosyalar

#### `src/components/SfcDismProgressDialog.tsx`

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
}

// useEffect içinde:
// listen<ProgressLine>("sfc-dism-progress", e => append(e.payload))
// listen<SfcDismSummary>("sfc-dism-complete", e => setSummary(e.payload))
```

Görünüm: modal, üstte iki aşama göstergesi (DISM ✓, SFC ⏳), altta son ~30 satır scrolling output (monospace, koyu arkaplan), bittiğinde "Onarıldı: X dosya" veya "Onarım gerekmedi" mesajı.

### Değişen dosyalar

#### `src/components/FindingCard.tsx`

`finding.action` varsa, mevcut layout'a uygun bir buton eklenir:

```tsx
{finding.action?.type === "runSystemFileCheck" && (
  <button onClick={onTriggerSfc}>DÜZELT</button>
)}
{finding.action?.type === "openUrl" && (
  <a onClick={() => openOemLink(finding.action.url)}>
    OEM sitesine git ↗
  </a>
)}
```

#### `src/lib/types.ts`

`Finding` + `FindingAction` + `ProgressLine` + `SfcDismSummary` mirror edilir.

#### `src/lib/api.ts`

```ts
export function runSystemFileCheck(): Promise<SfcDismSummary> { ... }
export function openOemLink(url: string): Promise<void> { ... }
```

#### `src/App.tsx`

- Sfc dialog state (`sfcOpen: boolean`)
- `onTriggerSfc` → confirm modal → onaylanırsa `setSfcOpen(true)` + `runSystemFileCheck()` çağır
- `useEffect` ile `sfc-dism-progress` / `sfc-dism-complete` event listener'ı

#### `src/lib/i18n.ts`

Yeni anahtarlar: `eventLogSection`, `driverFindingsSection`, `systemFileCheckTitle`, `sfcStarting`, `sfcRunning`, `sfcComplete`, `sfcRepairedFiles`, `sfcNoRepairsNeeded`, `goToOem`, `openingBrowser`, `lastNDays` vs.

## Veri akışı (uçtan uca)

```
[TARA tıklama]
  → invoke("scan")
    → collectors::disk::list_volumes()
    → collectors::event_log::scan_recent_critical()  [YENİ]
    → collectors::drivers::list_outdated_drivers()   [YENİ]
    → diagnostics::disk_full::evaluate(...)
    → diagnostics::event_log::evaluate(...)          [YENİ]
    → diagnostics::drivers::evaluate(...)            [YENİ]
    → collectors::cleanup_targets::scan_all()
  ← ScanReport { volumes, findings, cleanup_targets, ... }

[Finding'de DÜZELT (sfc) tıklama]
  → ConfirmDialog ("sfc + DISM çalışacak, ~15-30 dk")
  → onConfirm:
    → invoke("run_system_file_check") (async, döner ama event'ler akmaya başlar)
    → setSfcOpen(true)
  ← event "sfc-dism-progress": { phase, text, percent }
  ← event "sfc-dism-complete": { dism_ok, sfc_ok, repaired_files, log_tail }

[Driver Finding'de OEM linki tıklama]
  → invoke("open_oem_link", { url })
    → tauri-plugin-shell → ShellExecute (browser açar)
```

## Hata yönetimi

| Senaryo | Davranış |
|---|---|
| Event Log boş veya provider yok | Empty signature listesi, Finding üretilmez. Hata değil. |
| WMI Win32_PnPSignedDriver erişimi başarısız | Boş driver list, log warning. Tarama devam eder. |
| sfc/DISM başlatma — admin değil | `NeedsElevation` (mevcut elevation banner zaten halleder). |
| sfc başarısız (exit code != 0) | Summary'de `sfc_ok=false`, log_tail kullanıcıya gösterilir. |
| Tarayıcı açılamadı (shell plugin fail) | `Browser açılamadı: <e>` toast/error. URL clipboard'a kopyalanır (opsiyonel). |
| Event Log'da PowerShell çıktısı bozuk JSON | Parse hatası loglanır, boş liste döner. |

## Güvenlik notları

- **OEM linkleri** sadece HTTPS, allowlist'te bilinen OEM domain'leri + Google search. Capabilities'te `shell:allow-open` URL pattern'i `https://**`.
- **sfc/DISM** çıktısında kullanıcı adı/IP/MAC olmaz (sistem dosya yolları olur). Telemetri OFF varsayılan (PRD).
- **Driver listesi** sadece imzalı sürücüler. İmzasız flag'i Finding olarak gösterilir ama otomatik aksiyon yok.
- **Allowlist** ihlali yok — sfc/DISM Windows'un kendi araçları, korumalı klasör erişimi onlarda.

## Test stratejisi (smoke)

1. `cargo check` — Rust compile temiz
2. `npm run build` — TS + Vite temiz
3. `npm run tauri dev` (non-elevated) — pencere açılır, TARA çalışır, Event Log + Driver Finding'leri görünür
4. Bir BugCheck Finding'inde DÜZELT — `NeedsElevation` banner çıkar (admin değiliz)
5. Admin terminalden `npm run tauri dev` → TARA → BugCheck DÜZELT → sfc modal'ı açılır → progress satırları akar → "Onarım gerekmedi" özeti
6. Driver Finding'inde "OEM sitesine git" → default tarayıcıda NVIDIA/AMD/Intel sayfası açılır
7. Disk doluluk + Event Log + Driver Finding'leri aynı raporda görünür, severity sırasında

## Bilinen kısıtlar (Sprint 2 sonu)

- Sfc/DISM iptal edilemiyor — bir kere başlayınca biter
- Driver güncelliği "DriverDate > 2 yıl" basit kuralı; gerçek "güncel mi" Windows Update API ile bilinebilir → Sprint 3
- Event Log analizi PowerShell üzerinden — kısa lag (~1-3 sn ek tarama süresi)
- Claude API yok — Finding metinleri Türkçe sabit string, AI ile zenginleştirme Sprint 2b

## Açık olmayan kararlar (Sprint 2b ve sonrası için)

- Claude API key Settings ekranında DPAPI ile saklama
- Cancellation token sfc/DISM için
- Wmi crate yerine windows-rs direkt erişim (performans)
- Driver güncel mi diye Windows Update API kontrolü
