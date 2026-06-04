# Sprint 10 — Sprint 9 Hardening + Trendline Feature

**Tarih**: 2026-06-02
**Effort**: ~17 saat (2.5 gün), 4 faz
**Kapsam kararı**: 4-lens workflow + sentez

## Amaç

Sprint 9'da 11 critical+high fix uygulandı; **adversarial review olmadan production riskli** (cancel_live_only race window). 3 sprintlik manuel security grep disiplini (fsutil/bcdedit/BootExecute) **tests/security_invariants.rs ile kalıcılaştırılmalı**. 3 sprintlik biriken `scan_findings` verisi **kullanıcı tarafından görünmüyor** — Sprint 10'un ürün yüzü trendline olur.

## Dahil

| Aday | Faz | Effort | Risk |
|------|-----|--------|------|
| **L9** Sprint 9 adversarial review | 1 | medium | low |
| **CI** tests/security_invariants.rs | 2 | small | low |
| **T** Trendline (scan_findings_trend + HistoryDialog sparkline) | 3 | medium | low |
| **M-batch** UX-affecting subset (4-5 bulgu) | 4 | small | low |

## Ertelenen (Sprint 11+)

- **MV** multi-volume HashMap — single-session invariant kırma; user case kanıtlanmamış
- **L-batch** 20 PASS aksiyonsuz; 3-5 gerçek low → Sprint 11 sonu cleanup
- **K-ext** metric_code Backend migration — Sprint 9 frontend helper symptom'i kapattı

## Faz planı

### Faz 1 — Sprint 9 Hardening Review (L9) — ~5h

6-lens workflow Sprint 9 değişiklikleri için:
- **C1+C2 yeni cancel_live_only**: take_session → match → put_session race window? Başka thread arada take_session yaparsa ScheduledFix KAYBOLUR (invariant #22 ihlali).
- **H2 PATH_RE**: yeni regex `[^\r\n<>"|?*]*` over-scrub yapıyor mu? Edge cases.
- **H3 Dialog focus**: `[data-autofocus]` selector pattern öbür dialog'larda da gerek mi? Eski Sfc/Defender dialog'ları?
- **H4 sr-only live region**: 10sn bucket logic doğru mu? Edge: remaining=0?
- **H5 restoreErrorChkdsk state**: retry akışı doğru mu? Race condition?
- **H6 rollback chkntfs::cancel**: pending_state write fail sonrası rollback fail ederse?
- **H7 ChkdskPendingBanner registry crosscheck**: race condition (banner mount + cancel paralel)?
- **H8 cancel_pending_chkdsk**: chkntfs fail durumunda reboot::abort_reboot çağrısı yine çalıştırıldı — gerek mi?
- **H9 ChkdskBootResultBanner volume**: queryPendingChkdsk → fetchLastChkdskResult race?

Critical+High bulgularını aynı faz içinde uygula. Medium+Low Sprint 11.

### Faz 2 — Security CI Guard (CI) — ~2h

`src-tauri/tests/security_invariants.rs` (entegre test):

```rust
//! 3 sprintlik manuel grep disiplinini regression-proof yap.

#[test]
fn no_fsutil_dirty_set() { /* substring deny */ }
#[test]
fn no_bcdedit_anywhere() { /* substring deny */ }
#[test]
fn no_bootexecute_registry_write() { /* substring deny + winreg crate usage check */ }
#[test]
fn no_chkdsk_fx_combination() { /* /f + /x args YASAK */ }
#[test]
fn no_chkntfs_d_flag() { /* /d args YASAK */ }
#[test]
fn shutdown_t_clamp_constants_match() { /* MIN_SECONDS/MAX_SECONDS sabit */ }
#[test]
fn exe_paths_hardcoded_system32() { /* chkdsk/chkntfs/shutdown literal */ }
```

Pure additive — production kod değişmez. Sprint 11+'da yanlışlıkla kurala karşı kod gelirse CI fail.

### Faz 3 — Trendline Feature (T) — ~6h

**Backend**:
- `history/commands.rs`: `pub async fn scan_findings_trend(code: String, days: u32) -> Vec<DateCount>`
- `DateCount { date: String, count: u32 }`
- Whitelist regex code `^finding\.[a-z_]+\.[a-z_]+\.[a-z_]+$`
- days clamp `1..=90`
- Prepared statement, prepared SELECT:
  ```sql
  SELECT date(created_at) AS d, COUNT(*) AS c
  FROM scan_findings
  WHERE code = ?1 AND created_at >= date('now', '-' || ?2 || ' days')
  GROUP BY d ORDER BY d ASC
  ```

**Frontend**:
- `lib/types.ts`: `DateCount`
- `lib/api.ts`: `scanFindingsTrend(code, days): Promise<DateCount[]>` wrapper
- `components/TrendSparkline.tsx` — pure SVG sparkline (12-30 nokta yeterli, no library)
- `HistoryDialog.tsx` `FindingRow` — sparkline mini-kartı drawer içinde her satır altında (lazy: ilk gösterimde fetch + cache)
- 4 yeni i18n key: `trendLast30Days`, `trendNoData`, `trendCount{n}`, `trendDateRange`

### Faz 4 — UX-Affecting M-batch Subset (M-batch) — ~4h

Sprint 8 review medium'lardan yalnız 4-5 kritik:
1. **Dialog focus restore edge cases** — Cancel butonuna yanlışlıkla basma (invariant #22 UI)
2. **i18n missing keys regression check** — `findings.tr.ts` SSoT type Sprint 9 sonrası test (yeni 4 trend key dahil)
3. **cancel_scan dead helper SİL** — `commands.rs::cancel_chkdsk_scan` artık `cancel_session()` doğrudan çağırsın; cleared/aborted ChkdskCancelOutcome dön
4. **ChkdskMode dead enum kaldır** — `chkdsk.rs` ChkdskMode hiç kullanılmıyor; compile warning sil
5. **scheduled_at unused field** — `ChkdskSession::ScheduledFix { scheduled_at: String }` artık kullanılmıyorsa Option veya `#[allow(dead_code)]`

Pure compile warning + stil bulguları Sprint 11.

## Çiğnenemez invariantlar (Sprint 6-9 tüm + Sprint 10 yenisi)

- Sprint 6-9 hepsi korunur
- **Yeni**: `tests/security_invariants.rs` Backend invariantlarının test-time guard'ı (Faz 2)
- T backend SELECT prepared statement, code whitelist regex, days clamp
- Trendline read-only — write path'e dokunmaz
