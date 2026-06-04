# Sprint 7 — Locale Tamamlama + Process Lifecycle Hardening + History v2 Şema

**Tarih**: 2026-06-02
**Effort**: ~22 saat (2.75 gün)
**Kapsam kararı**: 4-lens (security/UX/architecture/product) adversarial workflow sentezi

## Amaç

Sprint 6'nın hardening borcunu kapat, Sprint 8'in büyük teması olan **chkdsk /f reboot onarımı (A)** için güvenli zemin hazırla:

1. **chkdsk process lifecycle invariant tamamlanır** (E + C)
2. **9 kategoride TR-hardcoded stringler code+params yapısına migrate edilir** — EN locale production-ready (B)
3. **scan_findings v2 şeması ve yazım yolu** — UI Sprint 8'e bırakılır ama veri Sprint 7'den birikmeye başlar (G partial)

## Dahil edilen

| Aday | Faz | Effort | Risk | Gerekçe |
|------|-----|--------|------|---------|
| **E** | 1 | small | low | Sprint 6 `Mutex<Option<Child>>` + `cancel_scan()` eklendi; `tauri::RunEvent::Exit` hook olmadan eksik. App kapanırsa chkdsk orphan kalır — DoS. |
| **C** | 1 | xs | low | App.tsx `RESTORE_ERROR_PREFIX` TR string substring match yapıyor; EN locale'de recovery flow sessizce bozulur. `NEEDS_ELEVATION` pattern simetrisinde `RESTORE_FAILED:` sentinel. |
| **B** | 2 | large | medium | 9 diagnostic dosyası TR-hardcoded `Finding { title, description, ... }`. EN locale yarım = production-incompatible. ~70 string × 2 dil. |
| **G** (partial) | 3 | medium | medium | `scan_findings(scan_id FK, code, severity, params_json)` migration v2. record_scan yazım. UI Sprint 8'e. PII whitelist + path normalize zorunlu. |

## Ertelenen (Sprint 8+)

| Aday | Neden |
|------|-------|
| **A** (chkdsk /f reboot) | Sprint 8 ana teması. Önkoşul E+C+G v2 burada hazırlanır. UX (countdown, recovery), security (RestorePoint, BootExecute YASAK, post-reboot result toplama) tek sprinte sığmaz. |
| **D** (pagefile RAM 16 GB binary edge) | xs ama kullanıcı-görünmez. Sprint 8 boş slot. |
| **F** (tray + autostart) | Power-user feature. Non-technical hedef için anti-pattern. Scheduled task elevated registration güvenlik invaryantına ters. |
| **H** (DPAPI/sqlcipher) | DB'de PII yok (mevcut invariant). sqlcipher +6 MB binary + CI complexity. I ile birlikte yapılır. |
| **I** (telemetry) | B+G PII whitelist olgunlaşmadan tehlikeli. GDPR/KVKK consent flow. Ürün-pazar uyumu sonrası. |

## Faz planı

### Faz 1: Process Lifecycle Hardening (E + C) — 4 saat

**Faz 1a (C)** — `RESTORE_FAILED:` sentinel:
- `src-tauri/src/commands.rs`: `pub const RESTORE_FAILED: &str = "RestoreFailed";` (NEEDS_ELEVATION simetri)
- `execute_cleanup`: Restore Point fail durumunda `format!("{RESTORE_FAILED}: {orig}")` döner
- `src/lib/api.ts`: `RESTORE_FAILED_SENTINEL` + `RestoreFailedError extends Error` (NeedsElevationError pattern)
- `src/App.tsx`: `RESTORE_ERROR_PREFIX` kaldır, `instanceof RestoreFailedError` ile yakala

**Faz 1b (E)** — exit hook:
- `src-tauri/src/lib.rs`: `.build()?.run_with(|app, event| { if matches!(event, RunEvent::Exit) { chkdsk_remediation::cancel_scan(); } })` veya equivalent Tauri 2 API
- `cancel_scan()` zaten Sprint 6'da var; sadece çağrı eklenir

### Faz 2: i18n Migration + Locale Borç Tasfiyesi (B) — 10 saat

9 diagnostic dosyası code-only Finding'e migrate:
- `drivers.rs`, `defender.rs`, `smart.rs`, `thermal.rs`, `security_config.rs`, `updates.rs`, `startup.rs`, `crash_history.rs`, `event_log.rs`, `disk_full.rs`

Her Finding için:
- `title` → `title_code` + `findings.tr.ts`/`findings.en.ts` entry
- `description` → `description_code` + entry
- `recommended_action` aynen kalır (Sprint 8'de migrate)
- `category` literal kalır (Backend → frontend ScanSummary `matches[]` filter zaten Backend literal'ı bekliyor)
- `metric` nötr format (Sprint 6 hardening'den)

**Params whitelist** (PII güvenliği):
- Kategori başına izinli anahtarlar:
  - drivers: `{driverName, manufacturer, ageYears, driverClass}` — `driverName` whitelist (NVIDIA/AMD/Intel/Realtek kategorisi; OEM-controlled, PII değil)
  - defender: `{threatCount, threatSample, ageDays}` — threatSample kısaltılır (16 char max)
  - smart: `{diskName, healthStatus, wearPercent, tempCelsius, errorTotal}` — diskName Get-PhysicalDisk friendly_name (OEM)
  - thermal: `{maxTempCelsius, zoneCount, loadPercent, perfPercent}`
  - security_config: `{profileNames, vendorName, ageGroupedDays}` — vendorName WSC katalog
  - updates: `{count, securityCount, sampleTitles}` — sampleTitles 3 öğe, 80 char max
  - startup: `{itemCount, lastBootMs, itemNames}` — itemNames whitelist
  - crash_history: `{wer30d, topSource, topCount, lastOccurredShortDate}` — yol normalize edilir
  - event_log: `{provider, eventId, count, sampleMessageShort}` — sampleMessage 120 char max, kullanıcı yolu `%USERPROFILE%`'a normalize
  - disk_full: `{mount, freePercent, freeBytes}` — mount letter zaten letter

**Yardımcı**:
- `src-tauri/src/diagnostics/util.rs`: `normalize_path(s: &str) -> String` (C:\Users\X\ → %USERPROFILE%\), `truncate(s: &str, n: usize)` helper
- `src-tauri/tests/i18n_coverage.rs`: emit edilen tüm code'lar EN+TR dict'te var mı? (test cargo run değil, frontend test'i — backlog Sprint 8 CI'ya)

### Faz 3: History v2 Schema + Findings Persistence (G partial) — 5 saat

`schema.rs` migration v1 → v2:
```sql
CREATE TABLE IF NOT EXISTS scan_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    code TEXT NOT NULL,       -- "finding.pagefile.undersized.title" (title_code'dan)
    category TEXT NOT NULL,   -- "Sanal bellek" / "Disk" / vb. (legacy literal)
    severity TEXT NOT NULL,   -- "critical" / "warning" / "info" / "good"
    params_json TEXT,         -- JSON string, NULL ise boş
    created_at TEXT NOT NULL  -- ISO-8601
);
CREATE INDEX IF NOT EXISTS idx_scan_findings_scan ON scan_findings(scan_id);
```

`record_scan`:
- INSERT scans (mevcut)
- For each finding: INSERT scan_findings (params_json whitelist'ten geçer)
- Tek transaction (atomicity)

UI değişikliği yok (Sprint 8: HistoryDialog detail expand).

### Faz 4: Test + QA + Smoke — 3 saat

- `cargo test` — lifecycle (E) için manuel smoke (process leak Task Manager), schema migrate idempotency
- npm build verify
- EN/TR locale switch smoke (9 kategori TR/EN doğru görünür)
- Restore point fail sentinel UI banner testi
- DB inspect: scan_findings yazılıyor, params_json PII içermiyor
- Adversarial review workflow (Sprint 6 pattern'i)

## Güvenlik invaryantları

Hiçbiri zayıflatılmaz, aksine sertleştirilir:
- **PII whitelist** (B+G ortak): per-category anahtar listesi; serbest string YASAK
- **Path normalize** (G): `C:\Users\<name>\` → `%USERPROFILE%\`
- **Event log message yazımı YASAK**: sadece event_id, provider, short-date; mesaj truncate edilir veya hiç yazılmaz
- **Process lifecycle invariant** (E): app exit → chkdsk kill garantili
- **System Restore zorunlu**: chkdsk /f Sprint 8'de — sentinel pattern ile uyumlu

## Bağımlılık zinciri

```
C (sentinel pattern) ──┐
                       ├──> B (i18n + RESTORE_FAILED frontend pattern aynı sentinel)
E (exit hook) ─────────┘
                       └──> G (params_json B whitelist kullanır)
```
