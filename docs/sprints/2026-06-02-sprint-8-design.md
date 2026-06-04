# Sprint 8 — chkdsk /f Remediation

**Tarih**: 2026-06-02
**Effort**: ~26 saat (3 gün), 4 faz
**Kapsam kararı**: 4-lens workflow (security/architecture/UX/reliability) + sentez

## Amaç

Sprint 7'de zemin hazırlandı (lifecycle hook ✓, sentinel pattern ✓, schema v2 ✓, sanitize_params ✓). Sprint 8: Kullanıcı `chkdsk /scan`'den `ErrorsFound` aldıktan sonra **gerçek onarım** (`/f`) çalıştırabilsin.

- **Non-system drive** (D:, E:): canlı `chkdsk /f` (volume lock; reboot YOK)
- **System drive** (C:): `chkntfs /c C:` ile autochk'ı next boot'a planla + `shutdown.exe /r /t 120` countdown
- **Restore Point ZORUNLU** (execute_cleanup pattern reuse + RESTORE_FAILED sentinel + force escape)
- **Post-reboot result**: Wininit EventID 1001 best-effort fetch

## Çiğnenemez güvenlik invariantları

1. **fsutil dirty set YASAK** — kullanıcı vazgeçemez, autochk sorgusuz çalışır
2. **BootExecute registry direct yazımı YASAK** — sadece chkntfs (Microsoft signed)
3. **bcdedit YASAK**
4. Komut path'leri hardcoded `C:\Windows\System32\` (chkdsk.exe, chkntfs.exe, shutdown.exe)
5. Argüman whitelist closed-set:
   - chkdsk `/scan`: `["<V>:", "/scan"]`
   - chkdsk `/f`: `["<V>:", "/f"]` (`/x` yasak — force dismount)
   - chkntfs schedule: `["/c", "<V>:"]`
   - chkntfs cancel: `["/x", "<V>:"]`
   - chkntfs `/d` (system-wide reset) YASAK
   - shutdown reboot: `["/r", "/t", "<60..=600>", "/c", SHUTDOWN_MESSAGE_CONST, "/d", "p:4:1"]`
   - shutdown abort: `["/a"]`
6. shutdown.exe `/t` clamp `60..=600` — 0 ve `<60` REDDET (kullanıcıya iptal şansı)
7. shutdown `/c` mesaj SABIT ASCII const, kullanıcı input interpolasyon YASAK (injection prevention)
8. Volume regex `^[A-Z]$` tek paylaşılan util (`remediation/volume.rs`)
9. Restore Point reboot scheduling ÖNCESİ (VSS reboot'ta çalışamaz)
10. Cancel sırası: `chkntfs /x` ÖNCE → `shutdown /a` SONRA → `pending_state::clear`
11. Sprint 7 H1 invariant: Mutex guard `kill()` SONRASI `wait()` ÖNCESİ drop edilir
12. ChkdskMode::FixLive && stage ≥ 4 (USN/free space write fazi): cancel REDDEDİLİR (NTFS journal replay riski)
13. Pending state Settings'ten AYRI (`app_data_dir/pending_chkdsk.json`); ground-truth chkntfs query
14. Sanitize_params DENY list genişler: `autochk_message`, `event_1001_body`, `chkntfs_output`, `volume_label`, `log_tail`, `chkdsk_log_tail`

## Yeni tipler

```rust
pub enum ChkdskStatus { Clean, ErrorsFound, Repaired, Scheduled, ScanFailed, Cancelled }
pub enum FindingAction {
    // ... mevcut variants
    RunChkdskFix { volume: String, is_system: bool },
}
pub struct ChkdskFixResult { volume, mode: "live"|"scheduled", system_drive, status, exit_code, errors_found, duration_seconds, log_tail, restore_point_created, restore_point_skipped_reason }
pub struct PendingChkdsk { volume, scheduled_at, reboot_pending }
pub struct ChkdskBootResult { volume, occurred_at, exit_code, status, summary_lines }
pub struct ChkdskCancelOutcome { schedule_cleared, reboot_aborted }
```

## Yeni komutlar

- `run_chkdsk_fix(volume, force_without_restore) -> ChkdskFixResult` (admin gate)
- `cancel_chkdsk_session() -> ChkdskCancelOutcome` (cancel current — live kill veya scheduled rollback)
- `schedule_chkdsk_reboot(seconds) -> ()` (admin gate; shutdown /r /t N)
- `abort_chkdsk_reboot() -> bool` (admin gerekmez; shutdown /a)
- `query_pending_chkdsk() -> Option<PendingChkdsk>` (JSON file + chkntfs query crosscheck)
- `cancel_pending_chkdsk(volume) -> ()` (chkntfs /x + shutdown /a + clear)
- `fetch_last_chkdsk_result(volume) -> Option<ChkdskBootResult>` (Wininit 1001, fail-soft)
- `check_chkdsk_scheduled_volumes() -> Vec<String>` (chkntfs query her fixed NTFS volume)

## Yeni sentinel'ler

- `SCHEDULE_INCONSISTENT` — chkntfs OK, shutdown fail, rollback başarısız
- `VOLUME_LOCKED` — non-system /f, volume in use, kullanıcıya manuel "next boot'a planla" sun
- `DISK_FULL_NO_RESTORE` — Restore Point için yer yok

## Yeni modüller

- `remediation/volume.rs` — `validate_volume`, `is_system_drive`, shared `VOLUME_RE`
- `remediation/chkntfs.rs` — schedule, cancel, query
- `remediation/reboot.rs` — schedule_reboot, abort_reboot, `SHUTDOWN_CHILD` Mutex
- `remediation/chkdsk_boot_result.rs` — Wininit 1001 fetch + parse_wininit_event_message (TR+EN regex)
- `safety/pending_state.rs` — `pending_chkdsk.json` read/write/clear + verify_against_os

## Faz planı

### Faz 1 — Backend (~10h)

1. `models.rs`: `ChkdskStatus::{Repaired, Scheduled}` variants; `FindingAction::RunChkdskFix`; yeni structs.
2. `admin.rs`: `SCHEDULE_INCONSISTENT`, `VOLUME_LOCKED`, `DISK_FULL_NO_RESTORE` const'lar.
3. `remediation/volume.rs`: paylaşılan validation.
4. `remediation/chkntfs.rs`: 3 fonksiyon + parse query.
5. `remediation/reboot.rs`: schedule + abort + `SHUTDOWN_CHILD`.
6. `remediation/chkdsk.rs`: `CURRENT_CHILD: Mutex<Option<Child>>` → `CURRENT_SESSION: Mutex<Option<ChkdskSession>>` enum; helper `stream_chkdsk_output`; `run_nonsystem_fix`; `schedule_system_fix`; `cancel_session` dispatch.
7. `remediation/chkdsk_boot_result.rs`: PowerShell Get-WinEvent.
8. `safety/pending_state.rs`.
9. `diagnostics/util.rs`: sanitize_params DENY list genişlet.
10. `commands.rs`: 8 yeni komut.
11. `lib.rs`: handler kayıt + RunEvent::Exit `SHUTDOWN_CHILD` kill (chkntfs schedule KORUNUR).

### Faz 2 — Persistence (~2h)

- `pending_state` unit tests (round-trip, corrupt fail-soft, verify_against_os mock)
- chkntfs query parser TR+EN fixtures
- `chkdsk_boot_result` parser TR+EN fixtures

### Faz 3 — Frontend (~8h)

1. `lib/types.ts`: yeni tipler + `ChkdskStatus` extend.
2. `lib/api.ts`: 8 wrapper + new error classes (`ScheduleInconsistentError`, `VolumeLockedError`, `DiskFullNoRestoreError`).
3. `components/ChkdskProgressDialog.tsx`: `mode?: "scan" | "fix-live"` prop; mode-aware labels; ErrorsFound altında "Onar (/f)" button.
4. `components/ChkdskFixConfirmDialog.tsx` (yeni) — system/non-system variants, default focus Cancel, force checkbox.
5. `components/ChkdskRebootCountdownDialog.tsx` (yeni) — countdown tabular-nums, aria-live, son 10sn assertive, default focus "Vazgeç".
6. `components/ChkdskPendingBanner.tsx` (yeni) — App mount'ta query, "Şimdi reboot" / "Sonra" / "İptal".
7. `components/ChkdskBootResultBanner.tsx` (yeni) — fetch_last_chkdsk_result fail-soft.
8. `App.tsx`: state machine `pendingChkdskFix: {stage, volume, isSystem, force}`; banner mount fetch.
9. `lib/i18n/tr.ts` + `en.ts`: ~25 yeni key.
10. `findings.tr.ts` + `en.ts`: `finding.chkdsk.errors_detected.fix` action label.

### Faz 4 — Test + smoke (~4h)

- `cargo test` — chkdsk refactor regression (H1 mutex pattern); chkntfs parse; reboot clamp; pending_state; sanitize_params new deny.
- Manuel smoke 5 senaryo (spec'te).
- `cargo check` + `npm run build` ✓.

## DEFERRED

- `MockRebootScheduler` trait abstraction (Sprint 9 telemetry/CI birlikte yapılırsa anlamlı)
- Telemetry `chkdsk_fix_scheduled` event Sprint 9
- HistoryDialog detail expand (scan_findings UI) Sprint 9
- Multi-volume parallel chkdsk Sprint 10+
