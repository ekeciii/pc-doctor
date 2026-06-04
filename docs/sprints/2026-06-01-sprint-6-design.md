# Sprint 6 Tasarımı — pagefile + chkdsk + history retention + Finding i18n (incremental)

**Tarih:** 2026-06-01
**Kapsam:** Sprint 6 — PRD'deki son 2 kategori (pagefile, chkdsk /scan), history retention enforcement, Finding i18n için incremental opt-in (yeni diagnostics code-only).
**Önceki:** Sprint 5 (Settings + EN i18n UI chrome + SQLite history).

## Yön

Workflow synthesis 16 yeni dosya + 17 modify öneriyor. Production-safe disipline için **scope'u küçültüyorum**:

| Plandaki | Sprint 6'da | Sprint 7'ye |
|---|---|---|
| pagefile (tanı) | ✅ | — |
| chkdsk /scan + repair (system + non-system + reboot modal) | ✅ /scan ONLY | repair + reboot |
| history retention | ✅ | — |
| Finding i18n (5 diagnostic + 2 yeni migrate) | YENİ 2 code-only | Mevcut 9 migration |
| ConfirmDialog (native confirm/alert kaldır) | — | ✅ |
| FindingBuilder API | basit | refine |

**Gerekçe**: Mevcut 9 diagnostics (smart, disk_full, defender, ...) hâlâ TR string emit edecek. Sprint 5'ten beri böyleler, EN locale'de bu Finding kartları TR görünüyor. Sprint 6 sadece YENİ pagefile + chkdsk için code-only başlangıç patterni atıyor — diğer diagnostics değişmiyor, regresyon riski sıfır. Sprint 7'de incremental migration.

## Kararlar

| Konu | Seçim |
|---|---|
| Finding struct | `title_code: Option<String>` + `description_code: Option<String>` + `action_code: Option<String>` + `params: Option<Map>` eklenir. **Legacy `title`/`description` `Option<String>` olur (geri uyumlu — Some(...) ile dolan eski path çalışmaya devam eder).** |
| Code namespace | `finding.<category>.<id>.<field>` (dot-separated) |
| Frontend resolver | `resolveFinding(finding, t)` tek nokta, code varsa interpolate, yoksa legacy fallback |
| Params syntax | Basit `{name}` interpolation (ICU değil) |
| pagefile remediation | YOK (sadece tanı + Settings deeplink) |
| chkdsk scope | `/scan` only — read-only, admin gerek, reboot yok |
| chkdsk arg whitelist | volume `^[A-Z]$` regex + sadece `/scan` |
| Retention | `record_scan` INSERT öncesi + `setup()` startup'ta (defense in depth) |
| VACUUM | clear_history'den kaldırıldı (lock süresi azaltır), Sprint 7'de Settings>Advanced butonu |
| FindingAction yeni varyantlar | `RunChkdskScan { volume }`, `OpenSystemPropertiesPerformance` |
| Cargo deps | `regex = "1"` (chkdsk volume whitelist) |

## Faz 1 — Foundation + history retention (~1 gün)

**Yeni dosyalar:**
- `src-tauri/src/history/retention.rs` — `enforce_retention(conn, days)` (defense-in-depth clamp, started_at < cutoff DELETE)
- `src/lib/i18n/findings.tr.ts` — Finding code dictionary TR (pagefile + chkdsk codes)
- `src/lib/i18n/findings.en.ts` — EN aynısı
- `src/lib/i18n/resolveFinding.ts` — code interpolation + legacy fallback

**Değişen:**
- `src-tauri/src/models.rs` — Finding opsiyonel i18n field'ları + FindingAction varyantları + PagefileSnapshot + ChkdskResult struct'ları
- `src-tauri/src/lib.rs` — setup() içinde retention enforce + PRAGMA optimize
- `src-tauri/src/history/commands.rs` — record_scan içinde retention çağrı + clear_history'den VACUUM kaldır
- `src-tauri/src/history/mod.rs` — `pub mod retention;`
- `src/lib/types.ts` — Finding optional title/description + i18n_code + params + 2 yeni FindingAction
- `src/lib/i18n/index.ts` — resolveFinding re-export
- `src/components/FindingCard.tsx` — resolveFinding kullan
- `src/components/SettingsDialog.tsx` — retention input altına helper text

## Faz 2 — pagefile (~1 gün)

**Yeni:**
- `src-tauri/src/collectors/pagefile.rs` — PowerShell one-shot snapshot (Win32_PageFileUsage/Setting + RAM + hibernation + hiberfil.sys size)
- `src-tauri/src/diagnostics/pagefile.rs` — F1-F4 kuralları (code-only, no hardcoded TR):
  - F1: manuel pagefile + max < 1.5×RAM + RAM<16GB → Warning (`finding.pagefile.undersized`)
  - F2: manuel pagefile + RAM≥16GB → Info (`finding.pagefile.consider_managed`)
  - F3: peak/alloc > 0.90 → Warning (`finding.pagefile.high_usage`)
  - F4: hibernation ON + hiberfil > 0.6×RAM + SSD + serbest <%15 → Info (`finding.pagefile.hibernation_disk_pressure`)
- `src-tauri/src/commands.rs` — `open_system_properties_performance` (SystemPropertiesPerformance.exe launcher via Command::new — exe konumu System32, admin gerekmez)

**Değişen:**
- `src-tauri/src/collectors/mod.rs` — `pub mod pagefile;`
- `src-tauri/src/diagnostics/mod.rs` — `pub mod pagefile;`
- `src-tauri/src/lib.rs` — scan() thread::scope'a pagefile spawn
- `src/lib/api.ts` — `openSystemPropertiesPerformance()` wrapper
- `src/components/ScanSummary.tsx` — "Sanal bellek" kategorisi ekle

## Faz 3 — chkdsk /scan (~1.5 gün)

**Yeni:**
- `src-tauri/src/collectors/chkdsk_volumes.rs` — Get-Volume ile fixed NTFS volumes + Event Log Ntfs/Disk EventID 55/98/130 cross-reference → `needs_repair: bool`
- `src-tauri/src/diagnostics/chkdsk.rs` — Event log flag'li volume için Finding (Warning, code `finding.chkdsk.errors_detected`, action `RunChkdskScan { volume }`)
- `src-tauri/src/remediation/chkdsk.rs` — chkdsk.exe /scan streaming wrapper (sfc/DISM pattern, line-by-line stdout → `chkdsk-progress` + `chkdsk-complete` events)
- `src/components/ChkdskProgressDialog.tsx` — sfc dialog clone, volume header + 5-stage progress + log tail

**Değişen:**
- `src-tauri/src/collectors/mod.rs` — chkdsk_volumes
- `src-tauri/src/diagnostics/mod.rs` — chkdsk
- `src-tauri/src/remediation/mod.rs` — chkdsk
- `src-tauri/src/commands.rs` — `run_chkdsk_scan(app, volume)` command (admin gate, volume regex `^[A-Z]$` validation, /scan only, system32 path zorla)
- `src-tauri/src/lib.rs` — invoke_handler!
- `src-tauri/Cargo.toml` — `regex = "1"`
- `src/lib/api.ts` — `runChkdskScan(volume)` + `onChkdskProgress` + `onChkdskComplete`
- `src/components/FindingCard.tsx` — RunChkdskScan action button (Wrench icon, t("chkdskScan"))
- `src/App.tsx` — chkdsk dialog state + handler
- `src/components/ScanSummary.tsx` — "Disk bütünlüğü" kategorisi
- `src/lib/i18n/tr.ts` + `en.ts` — chkdsk + pagefile UI string'leri

## Güvenlik invariantları

- ✅ chkdsk allowlist: volume `^[A-Z]$` regex; sadece `chkdsk.exe` from `%SystemRoot%\System32`; argüman whitelist `/scan` only
- ✅ pagefile tanı-only — registry/WMI yazma YOK
- ✅ pagefile action: `SystemPropertiesPerformance.exe` (Microsoft signed, System32) — UAC istemez, kullanıcı sistem panelinden manuel değişiklik yapar
- ✅ History retention: clamp(1, 3650) defense-in-depth, mutex zaten korur
- ✅ Finding i18n params PII-clean (drive letter, byte sayıları, gün sayıları — dosya yolu/hostname/username YOK)

## Smoke Test

- Fresh scan → Finding'ler render olur, mevcut 9 diagnostic TR kalır (regression yok), pagefile + chkdsk yeni Finding code'lardan resolve edilir (TR varsayılan)
- Settings → English → Pagefile/chkdsk Finding'leri EN, geri kalanlar TR fallback (kabul edilebilir, Sprint 7 migrate)
- Settings → retention 7 gün → kaydet → fake 30 günlük scan ekle (test fixture yok, manuel test) → app restart → startup retention enforce
- pagefile F1 simulate (Windows ayarlarından manuel pagefile düşük set): Warning Finding görünür, "Sanal Bellek Ayarlarını Aç" butonu SystemPropertiesPerformance.exe açar
- chkdsk /scan D: → admin gate → System Restore (opsiyonel /scan için) → streaming progress → ChkdskResult exit_code 0
- chkdsk allowlist regression: `run_chkdsk_scan("foo/../bar")` reject edilmeli

## Defer to Sprint 7

- chkdsk repair (`/f`, `/f /x`, system disk reboot scheduling + custom modal + cancel via chkntfs)
- Mevcut 9 diagnostics i18n migration (smart, disk_full, defender, security_config, event_log, drivers, thermal, updates, startup, crash_history)
- Native confirm/alert → brand ConfirmDialog migration
- FindingAction codegen (Rust enum → TS union auto-generate)
- Plural/select için ICU MessageFormat
- Settings>Advanced "Veritabanını sıkıştır (VACUUM)" butonu
- Pagefile programmatic write (registry/WMI + admin + restart)
- `RESTORE_ERROR_PREFIX` hardcoded TR string match → error code based
- tracing/structured logging
