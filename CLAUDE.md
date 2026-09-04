# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**PC Doctor** — Windows diagnostic/repair desktop app. Tauri 2 + React 18 + TypeScript + TailwindCSS v4 frontend; Rust backend. Target user is a non-technical Windows user who wants a "one-click PC check + safe fix" tool. Turkish-first UI (TR is the i18n SSoT) with full EN locale.

Status: 13 diagnostic categories, multi-volume chkdsk `/scan` + `/f` (live + scheduled+reboot), HistoryDialog with detail drawer + trend tab, full code-only Finding i18n (title/description/action/**recommendation** all resolve through `src/lib/i18n/findings.{tr,en}.ts` — no hardcoded display strings on the Rust side), a local AI chat assistant (`ai.rs`, Ollama on `127.0.0.1:11434` only), a large/unused-file finder that moves selections to the Recycle Bin (never permanent delete), and a composite CI guard (`npm run check:all`: version consistency → i18n parity → `cargo fmt`/`clippy -D warnings` → `prettier` → security invariants → Rust unit tests → `vitest` → frontend build). MIT-licensed. Findings still **dual-emit** the legacy `metric: String` alongside `metric_code: Option<MetricCode>` (frontend prefers `metric_code`); dropping the String field remains a deferred cleanup.

The detailed build-phase history (Sprint 2-12) lives in `docs/sprints/` (see that folder's README — the practice stopped after Sprint 12). Everything since is tracked in [`CHANGELOG.md`](./CHANGELOG.md) and git history; also check the user's auto-memory (`MEMORY.md` index) for context not yet written down anywhere else.

## Commands

```powershell
# Dev (HMR): Vite + cargo watch. Non-admin shell.
# Admin-gated commands (RestorePoint, sfc/DISM, chkdsk) require "Run as admin" via UI button.
npm run tauri dev

# Release bundle: src-tauri/target/release/bundle/{msi,nsis}/...
npm run tauri build

# Frontend-only Vite dev / build
npm run dev
npm run build

# Verification
npm run check:i18n          # Node script — TR/EN dict parity + t() call validation + backend-code coverage
npm run check:version       # 4 version sources (+ Cargo.lock) agree
npm run check:all           # Composite: version + i18n + fmt + clippy + prettier + cargo invariants + cargo lib + vitest + frontend build
cargo test --lib                     # In src-tauri/  — unit tests (75+)
cargo test --test security_invariants   # Source-tree CI guards (11 tests, see below)
cargo test <name>            # Single test by substring
node scripts/bump-version.mjs <X.Y.Z>   # Sync version across all 4 files + Cargo.lock
```

The release build embeds `manifest.xml` (`requireAdministrator`). Dev build does NOT embed it (`build.rs` checks `DEP_TAURI_DEV`) — exe starts as a regular user. Backend commands that need elevation return a `NeedsElevation:` sentinel, which the frontend converts to `NeedsElevationError` and surfaces an elevation banner + "Relaunch as admin" button. See `DEVELOPMENT.md` for the two ways to test elevated flows.

## Big-picture architecture

### Backend / Frontend split

Frontend (`src/`) is a thin React layer. All system-interaction work lives in Rust (`src-tauri/src/`). Communication: `invoke(name, args)` → `#[tauri::command]` functions in `commands.rs` + `history/commands.rs`. Wrappers live in `src/lib/api.ts`; all backend errors flow through `toError(e)` which parses sentinel prefixes (`NeedsElevation:`, `RestoreFailed:`, `ScheduleInconsistent:`, `VolumeLocked:`) into typed Error subclasses.

### Rust backend module shape

```
src-tauri/src/
├── lib.rs / main.rs          App entry, plugin registration, RunEvent::Exit hook
├── admin.rs                  is_elevated() + relaunch_as_admin() + sentinel constants
├── ai.rs                     Local AI chat (Ollama, 127.0.0.1:11434 only) — explains, never acts
├── commands.rs               All Tauri commands except history
├── models.rs                 DTO: Finding, MetricCode, ChkdskStatus, ChkdskSession, etc.
├── settings.rs               tauri-plugin-store Settings persistence
├── util/{powershell,system}.rs  Shared helpers (timed PS spawn, is_laptop OnceCell)
├── collectors/<category>.rs  Pure data gathering (WMI/PowerShell). No diagnosis logic.
├── diagnostics/<category>.rs Collector output → Vec<Finding>. Severity/threshold rules.
├── remediation/              Fix actions: cleanup, sfc, defender_scan, chkdsk, chkntfs,
│                             reboot, chkdsk_boot_result, volume (shared regex)
├── safety/                   allowlist, restore_point, pending_state (chkdsk JSON)
├── history/                  SQLite (rusqlite bundled): schema, commands, retention
└── tests/security_invariants.rs   Source-tree CI guards (see below)
```

The **scan pipeline** runs all collectors in parallel via `thread::scope` (commands.rs `scan_blocking`), then each diagnostic transforms its collector's output into `Vec<Finding>`. Findings carry a `title_code`/`description_code`/`action_code`/`recommendation_code` (i18n SSoT key) + `metric_code: Option<MetricCode>` (locale-bag value enum) + `params: serde_json::Value` (whitelisted PII-clean placeholder map). The frontend `resolveFinding(finding, locale)` + `metricLabelFromCode(mc, locale)` render the labels. `scripts/check-i18n.mjs` statically scans `src-tauri/src/**.rs` for literal `finding.<cat>.<id>.<field>` string references and asserts each exists in `findings.tr.ts` — a backend-code that's missing its dict entry fails CI (literal-only; codes built via `format!()` with a runtime variable aren't covered by that scan).

### chkdsk lifecycle — the most complex invariant

`remediation/chkdsk.rs` holds `CURRENT_SESSION: Mutex<Option<ChkdskSession>>` where `ChkdskSession` is `LiveScan(Child) | LiveFix(Child) | ScheduledFix { volume, scheduled_at }`. Two cancel functions exist and they are NOT interchangeable:

- **`cancel_session() -> (bool, bool, Option<String>)`** — user-initiated cancel. Kills live child OR runs `chkntfs::cancel(volume) + reboot::abort()` for `ScheduledFix`. Returns the cancelled volume so the caller can call `pending_state::remove(volume)` (not `clear`, which would wipe other multi-volume entries).
- **`cancel_live_only() -> bool`** — app-exit hook only. Takes the Mutex through the *entire* match (atomic; does NOT use `take_session` → `match` → `put_back` because that leaks `ScheduledFix` if another thread races). Only kills `LiveScan`/`LiveFix`. **Never touches `ScheduledFix`** — invariant #22: a user's scheduled autochk plan survives app exit.

When changing anything in this area, run `cargo test --test security_invariants` — `invariant_22_cancel_live_only_skips_scheduled_fix` is a source-grep guard.

### History persistence (SQLite, v2 schema)

`%APPDATA%/com.egeyu.pcdoctor/history.db` (rusqlite bundled, WAL+NORMAL+FK+5s busy_timeout). Manual `PRAGMA user_version` migration ladder in `history/schema.rs`:
- v1: `scans` (id, started_at, finished_at, counts, severity_max)
- v2: `scan_findings (scan_id FK ON DELETE CASCADE, code, category, severity, params_json, created_at)`

`record_scan` writes both atomically (single transaction). `params_json` goes through `diagnostics/util::sanitize_params(category, params)` — a per-category allow-list + deny-list defense layer; even if a collector accidentally emits PII, DB stays clean. **Always extend the allow list when adding a new param key.**

`pending_chkdsk.json` (Settings'ten ayrı dosya — sızıntı önleme) uses its own v1→v2 migration shim in `safety/pending_state.rs`: v1 = single object, v2 = `{ version, volumes: [...] }`. Corrupt JSON is renamed to `pending_chkdsk.json.corrupt-<ts>` instead of overwritten (data-loss prevention).

### i18n SSoT pattern

`src/lib/i18n/tr.ts` is the single source of truth — `as const` literal → `type TKey = keyof typeof tr`. `en.ts` is typed `Record<TKey, string>` so a missing EN key is a TypeScript error. Same pattern for finding codes: `findings.tr.ts` SSoT → `type FindingCode` → `findings.en.ts` exhaustive.

Backend emits `title_code` + `params` only (no display strings for new Sprint 6+ diagnostics). Frontend `resolveFinding` has tiered fallback (locale dict → TR dict → legacy `title` → empty). The `useT(key, params)` hook supports `{placeholder}` interpolation. `scripts/check-i18n.mjs` (run via `npm run check:i18n`) validates `t()` calls against TKey + template parameter parity.

## Non-negotiable security invariants

The codebase tracks a canonical ~30-invariant set (synthesized in Sprint 8). Source comments and the `tests/security_invariants.rs` function names reference these **canonical numbers** — e.g. `invariant_22_cancel_live_only_skips_scheduled_fix`, `invariant #17`. **A prose reference like "invariant #22" means that canonical number, NOT a list position.** The list below is the load-bearing subset using those same numbers; gaps (#7, #10, #12–16, #18–21, …) are other invariants in the full set.

Eleven are CI-guarded by source-grep tests in `tests/security_invariants.rs` (`cargo test --test security_invariants`) — marked *(test)* below; the rest are code-review rules *(review)*. Breaking any of them fails review/CI.

- **#1** No `fsutil dirty set` — autochk would run sorgusuz; user can't cancel. *(test)*
- **#2** No direct `BootExecute` registry writes; no `use winreg` in `src/`. *(test ×2)*
- **#3** No `bcdedit` command spawn. *(test)*
- **#4** exe paths hardcoded `C:\Windows\System32\{chkdsk,chkntfs,shutdown}.exe` — SystemRoot env hijack defense. *(test)*
- **#5** chkdsk arg whitelist `[V:, /scan]` or `[V:, /f]`. **No `/x`** (force dismount = data loss). *(test)*
- **#6** chkntfs arg whitelist `[/c, V:]`, `[/x, V:]`, or `[V:]`. **No `/d`** (system-wide reset). *(test)*
- **#8** shutdown `/t` clamped to `60..=600` (clamp constants must match). *(test)*
- **#9** shutdown `/c` message is a SABIT ASCII const (injection prevention). *(test)*
- **#11** Cancel ordering: `chkntfs /x` ONCE → `shutdown /a` SONRA → `pending_state::remove` (failure-safe). *(review)*
- **#17** `pending_chkdsk.json` is a SEPARATE file from Settings (settings-export leak prevention). *(review)*
- **#22** `cancel_live_only` (app-exit hook) never touches `ScheduledFix` — a scheduled autochk plan survives app exit. *(test)*
- **#23** System tweaks (`EnableFirewall`/`EnableUac`/`SetPagefileManaged`) only ever *strengthen* security — source-grep rejects `-Enabled False`, `EnableLUA' -Value 0`, `AutomaticManagedPagefile = $false` and similar weakening patterns anywhere in the codebase. *(test)*
- Volume regex `^[A-Z]$` shared via `remediation/volume.rs`; never copy-paste it. *(review)*
- Restore Point must be created BEFORE any reboot scheduling (VSS can't run during boot). *(review)*
- Sprint 7 H1 mutex pattern: when killing a child process, drop the `MutexGuard` BEFORE calling `child.wait()`. Holding the lock across wait starves other threads (`run_scan` worker). *(review)*

Beyond these, the broader PII invariants: DB stores no file paths, hostnames, usernames, threat names, or event-log message bodies. The `sanitize_params` allow-list is the last line of defense; treat it as load-bearing.

## Sprint workflow (historical — Sprint 2 through Sprint 12 only)

Sprint design docs live in `docs/sprints/<YYYY-MM-DD>-sprint-<n>-design.md` and follow a consistent pattern: 4-lens scope workflow → spec → 3-4 phases. **This practice stopped after Sprint 12** — see `docs/sprints/README.md`. Work since then (Sprint 13 onward, the launch-prep phases, everything on `main`) is tracked in [`CHANGELOG.md`](./CHANGELOG.md) and git history instead. The user's auto-memory `project_pc_doctor.md` still has a one-line-per-sprint summary index for the historical period — read it before extending anything sprint-doc-adjacent. Each sprint typically ended with the next sprint reviewing it adversarially (Sprint 7→reviewed Sprint 6, Sprint 8→7, etc.); critical+high findings got applied immediately, medium/low usually deferred.

## Adding a new diagnostic

1. `collectors/<name>.rs` — pure data gathering, no thresholds. Use `util::powershell::run_cim` (10s timeout) for WMI. Errors swallowed via `Option`/`Result::ok()`.
2. `diagnostics/<name>.rs` — turn collector output into `Vec<Finding>` using `Finding::code_only(...)` builder. Add `.with_metric_code(MetricCode::...)` for the badge value, `.with_params(json!({...}))` for template placeholders, `.with_action(FindingAction::...)` for the action button.
3. `commands.rs::scan_blocking` — spawn the collector + extend findings.
4. `findings.tr.ts` (SSoT) + `findings.en.ts` — add `finding.<category>.<id>.{title,description,action}` keys. Run `npm run check:i18n` to validate.
5. `components/ScanSummary.tsx` — add the category to `CATEGORIES` if it's new.
6. Extend `sanitize_params` allow-list in `diagnostics/util.rs` for any new param keys.

## Adding a new Tauri command

Register in `lib.rs::invoke_handler!`. Use `#[tauri::command]` + `async fn` + `tauri::async_runtime::spawn_blocking` for blocking work. Admin-gated commands return `Err(format!("{NEEDS_ELEVATION}: ..."))`. Other sentinel patterns (`RESTORE_FAILED`, `SCHEDULE_INCONSISTENT`, `VOLUME_LOCKED`) follow the same prefix convention so `src/lib/api.ts::toError` can route them to typed error classes.
