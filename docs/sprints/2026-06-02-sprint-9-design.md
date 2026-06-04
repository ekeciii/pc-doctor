# Sprint 9 — Tarihçe Detayını Aç, Sprint 8'i Sertleştir

**Tarih**: 2026-06-02
**Effort**: ~21 saat (2.5 gün), 4 faz
**Kapsam kararı**: 4-lens workflow (product/architecture/security/UX) + sentez

## Amaç

Sprint 8 büyüktü (4 yeni modül + chkdsk session refactor + 8 command + 4 component). Sprint 7 review pattern'iyle önce **adversarial review** (bulgular kalan fazları şekillendirir), sonra **kullanıcı değeri**: HistoryDialog detay drawer — `scan_findings` Sprint 7'den beri yazılıyor ama UI yok.

## Dahil (4 lens çoğunluk)

| Aday | Faz | Effort | Risk |
|------|-----|--------|------|
| **L** Sprint 8 adversarial review | 1 | medium | low |
| **J** RebootScheduler trait + mock | 2 | small | low |
| **D** Pagefile RAM 16 GB binary fix | 3 | xs | low |
| **G + K** HistoryDialog detail drawer + metricLabel helper | 4 | medium | low |

## Ertelenen (4 lens çoğunluk RET/defer)

| Aday | Neden |
|------|-------|
| **F** tray/autostart/scheduled scans | 4/4 lens RET. Non-tech persona için anti-pattern; scheduled task elevated registration Sprint 8 admin gate disiplinini bozar. Power-user pivot olmadan kesin RET. |
| **H** DPAPI/sqlcipher | DB'de PII YOK (Sprint 7 invariant), settings'te hassas veri YOK. Encryption koruyacak somut şey yok. Telemetri token gelince H+I birlikte Sprint 11+. |
| **I** Telemetry pipeline | Production endpoint yok, mock pipeline half-built kalır. GDPR/KVKK consent non-tech kullanıcıyı korkutur. H ile paketle. |

## Faz planı

### Faz 1 — Sprint 8 adversarial review (L) — ~6h

6-lens workflow (Sprint 7 pattern):
- Security: shutdown clamp, /a cancel ordering, BootExecute YASAK, fsutil/bcdedit YASAK, restore point ordering, sanitize_params 6 yeni DENY
- Correctness: chkdsk session refactor (H1 invariant korundu mu?), exit code mapping fix variant, multi-volume race
- PII audit: ChkdskFixResult log_tail content; chkdsk_boot_result message body
- Architecture: 4 modul boundaries, command surface, lib.rs RunEvent hook
- UX: countdown countdown UX, banner timing, ConfirmDialog default focus
- Spec compliance: 30 invariant Sprint 8 spec'i karşılayan kod mu?

Verify each finding adversarially. Critical+High → uygula; Medium+Low → Sprint 10.

### Faz 2 — RebootScheduler trait + Mock (J) — ~3h

- `remediation/reboot.rs`: trait `RebootScheduler { fn schedule(secs: u32) -> Result<(), String>; fn abort() -> Result<bool, String>; }`
- `WindowsRebootScheduler` (current impl wrap)
- `MockRebootScheduler` (no-op + call log; #[cfg(test)] veya cargo feature `reboot-mock`)
- Test: clamp 60..600 regression, /a abort 1116 idempotency, schedule sırası

### Faz 3 — Pagefile RAM 16 GB threshold fix (D) — ~2h

- `collectors/pagefile.rs`: `Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum` toplamından MB hesapla
- `diagnostics/pagefile.rs`: `const RAM_16GB_THRESHOLD_MB: u64 = 16 * 1024 - 256;` (16128) — F1+F2 ortak eşik
- 16 GiB sistem her iki dalda da tutarlı sınıflanır
- Unit test: 16384 MiB → manuel pagefile dalı, 8192 MiB → yetersiz dalı

### Faz 4 — HistoryDialog detail drawer (G + K) — ~10h

**Backend**:
- `history/commands.rs`: `pub async fn list_scan_findings(scan_id: i64) -> Vec<ScanFindingDetail>`
- Struct: `ScanFindingDetail { id, code, category, severity, params_json }`
- SELECT `scan_findings WHERE scan_id = ? ORDER BY id ASC`

**Frontend**:
- `lib/api.ts`: `listScanFindings(scanId): Promise<ScanFindingDetail[]>`
- `lib/types.ts`: `ScanFindingDetail`
- `components/HistoryDialog.tsx`: expand/collapse her satır için drawer
- Drawer içeriği: each finding `resolveFinding({titleCode, descriptionCode, params}, locale)` ile render
- **K alt-görev**: `lib/i18n/metricLabel.ts` — `metricLabel(category, params, locale)` helper; Sprint 7'de Backend metric "%5.0" / "10" / "C°70" karışık → frontend locale-aware label
- i18n yeni keys: `historyDetailTitle`, `historyDetailEmpty`, `historyDetailExpand`, `historyDetailCollapse`

## Çiğnenemez invariantlar

- Sprint 6+7+8 tüm güvenlik invariantları (fsutil dirty set YASAK, BootExecute YASAK, hardcoded paths, arg whitelist, vb.)
- Sprint 7 H1 (Mutex guard kill ÖNCE drop)
- `list_scan_findings` SELECT-only, side-effect yok, scan_id integer
- Params_json zaten Sprint 7 sanitize_params'tan geçmiş (DB-clean) → frontend ek filter gerekmez
- F kesinlikle eklenemez (Sprint 7+8+9 üç lens onayı)
