# Sprint 5 Tasarımı — Settings + i18n + Scan History

**Tarih:** 2026-06-01
**Kapsam:** PC Doctor Sprint 5 — Settings ekranı + EN i18n locale switching (Faz 1) + Scan History SQLite (Faz 2).
**Önceki sprint:** Sprint 4 (Tauri updater + bundle + CI + landing — production-ready).

## Amaç

Sprint 1-4'te biriken iki kullanıcı-görünür eksikliği kapatmak:
1. **TR/EN locale switching** (PRD'nin UX prensibi, Sprint 1'den beri "TR-only" placeholder).
2. **Scan history** — non-technical kullanıcı için "geçen hafta da aynı uyarıyı vermiştin" güven sinyali (rakip CCleaner/Glary/BleachBit'te yok veya paid).

Settings ekranı bu ikisini host eder + telemetri opt-in flag'ini PRD invariantına uygun (default OFF) saklar + freemium gating için zemin hazırlar (Sprint 5'te freemium implement edilmez).

## Kararlar (scope research workflow synthesis'inden)

| Karar | Seçim |
|---|---|
| SQLite client | `rusqlite 0.32` bundled + chrono feature |
| SQLite async | `tauri::command async + spawn_blocking` (Sprint 4 ile tutarlı) |
| SQLite migration | Manuel `PRAGMA user_version` (1 tablo, refinery/rusqlite_migration overkill) |
| SQLite connection | Tek `Mutex<Connection>` (r2d2 yok) |
| SQLite PRAGMA | WAL + synchronous=NORMAL + foreign_keys=ON + busy_timeout=5000 |
| i18n state | Custom React Context + `useT()` hook (react-i18next/Lingui overkill) |
| i18n type safety | TR SSoT, EN `Record<keyof typeof tr, string>` (eksik key = compile error) |
| i18n syntax refactor | `t.foo` → `t("foo")` (modül-scope obj → hook çağrısı, zorunlu) |
| i18n bundle | 2 locale inline (~3KB each, lazy gereksiz) |
| Settings storage | `tauri-plugin-store v2` (debounced autosave + LazyStore) |
| Settings backend | `Arc<RwLock<Settings>>` in-memory + plugin-store persistence |
| Settings frontend↔backend | Tauri commands (`get_settings`/`save_settings`); frontend plugin-store'a direkt değmez |
| DPAPI | Bu sprint'te YOK (history şu an PII içermiyor) |

## Faz 1 — i18n + Settings (~4 gün)

**Yeni dosyalar (8):**
- `src/lib/i18n/{tr,en,context,format,index}.ts(x)` — locale altyapısı
- `src/lib/settings.ts` — Tauri command wrapper'ları
- `src/components/SettingsDialog.tsx` — UI
- `src-tauri/src/settings.rs` — Rust struct + state + commands

**Değişen dosyalar (~17):**
- `Cargo.toml` — `tauri-plugin-store = "2"`
- `package.json` — `@tauri-apps/plugin-store ^2`
- `capabilities/default.json` — `store:default`
- `src-tauri/src/lib.rs` — plugin register + state + commands
- `src/main.tsx`, `src/App.tsx`, `Header.tsx` + 11 component — `t.foo` → `t("foo")` + `useT()` (102 occurrence, codemod-driven)
- `CleanupPanel.tsx` — `useByteFmt()` (tr-TR hardcoded fix)

**Faz 1 DoD:**
- `cargo check` + `npm run build` temiz
- Settings dialog açılır, locale TR ↔ EN runtime'da swap eder (FOUC yok)
- Locale + telemetri seçimi persist eder (kapat-aç)
- Telemetri default **OFF** (invariant)
- Backend Finding metinleri TR kalır (Sprint 6 backlog)

## Faz 2 — Scan History (~5 gün)

**Yeni dosyalar (4):**
- `src-tauri/src/history/{mod,schema,commands}.rs` — SQLite katmanı
- `src/components/HistoryDialog.tsx` — UI

**Değişen dosyalar (~6):**
- `Cargo.toml` — `rusqlite = { version = "0.32", features = ["bundled", "chrono"] }`
- `src-tauri/src/lib.rs` — history mod + state + commands
- `src-tauri/src/settings.rs` — history_enabled okuyucu helper
- `src/lib/api.ts` — `recordScan`/`listScans`/`clearHistory`
- `src/App.tsx` — scan sonrası `if settings.history_enabled { recordScan(report) }` (fire-and-forget)
- `src/components/SettingsDialog.tsx` — history retention slider + "Geçmişi göster"/"temizle" butonları

**Schema (v1):**
```sql
CREATE TABLE scans (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  finding_count INTEGER NOT NULL,
  critical_count INTEGER NOT NULL,
  warning_count INTEGER NOT NULL,
  severity_max TEXT NOT NULL
);
```

PII YOK: dosya yolu/hostname/username yazılmıyor. Aggregate sayılar + zaman + severity.

**Faz 2 DoD:**
- `cargo check` + `npm run build` temiz
- 2 ardışık scan → HistoryDialog'da 2 kayıt
- `history_enabled` OFF iken scan kaydedilmez
- "Geçmişi temizle" çalışır
- Türkçe karakterli kullanıcı path'inde DB açılır

## Riskler

1. **Faz 1 → Faz 2 bağımlılığı**: `settings.history_enabled` scan() içinde okunacak; Faz 1 önce merge edilmeli.
2. **t.foo refactor**: 102 occurrence, codemod regex `\bt\.([a-zA-Z]+)\b` → `t("$1")`. `updater.ts` modül-scope — hook çağrısı yapılamaz, error code emit + caller'da çevir.
3. **Backend Finding metinleri TR kalıyor** — Sprint 6 code-based refactor backlog. EN locale'de UI chrome EN, Finding kartları TR (release notes'a not).
4. **App.tsx `RESTORE_ERROR_PREFIX` hardcoded TR** — Finding refactor ile birlikte düzelt (Sprint 6).
5. **plugin-store TS+Rust drift**: TS'den `Store` import etme, command'lar üzerinden konuş.
6. **PRAGMA WAL**: `.db-wal`/`.db-shm` AV/Defender flag riski — release notes.
7. **Bundle identifier**: `com.egeyu.pcdoctor` Windows convention'ı, AppData path'ine ekleniyor.
8. **rusqlite ilk derlemede +30-60s** — CI cache stratejisi.

## Defer'd (Sprint 6+)

- Backend Finding code-based refactor (Rust `code` + frontend label map)
- `RESTORE_ERROR_PREFIX` error code refactor
- 3+ dil + lazy-load + ICU MessageFormat
- rusqlite_migration / refinery
- r2d2 connection pool
- DPAPI settings/history şifreleme
- `scan_findings` detay tablosu
- History retention enforcement (otomatik eski kayıt silme)
- Telemetry pipeline implementation
- Cross-window settings-changed event

## Ajan zinciri

```
Faz 0: scope research workflow ✓ (bu spec)
Faz 1: rust-backend (settings.rs + lib.rs) + react-ui (i18n + SettingsDialog + refactor)
       + tauri-specialist (plugin-store capability) + localization (en.ts)
Faz 2: database-architect (schema) + rust-backend (history mod) + react-ui (HistoryDialog)
Faz sonu her ikisinde: adversarial-reviewer + security-reviewer
Final: memory-keeper
```
