# Sprint 11 — L10 Review + Multi-Volume Schema + Trend Sinyali

**Tarih**: 2026-06-02
**Effort**: ~20 saat (2.5 gün), 3 faz
**Kapsam**: 4-lens workflow + sentez

## Amaç

Sprint 10'da inen 6 fix review olmadan production'a çıkamaz; H6 multi-volume PRD vaadi; T-ext kullanıcı değeri ("sorun büyüyor mu?"). K-ext + M-batch2 Sprint 12'ye.

## Dahil

| Aday | Faz | Effort | Risk |
|------|-----|--------|------|
| **L10** Sprint 10 hardening review | 1 | medium | medium |
| **H6** backend pending_chkdsks v2 schema | 2 | medium-large | medium |
| **T-ext partial** HistoryDialog Trend tab + 3-week critical alert | 3 | medium | low |
| **D-ext** Win32_PhysicalMemory.Capacity ham kanal | 3 (paralel) | xs | low |

## Ertelenen (Sprint 12+)

- **K-ext** 9 diagnostic metric_code — Sprint 11 H6 migration + L10 review üzerine ikinci migration yükü
- **M-batch2** 22 medium — kritik subset Sprint 12'de K-ext ile birlikte
- **H6 multi-banner UI** — backend migration kararını izole et, UI churn Sprint 12

## Faz planı

### Faz 1 — L10 review (6h)

Sprint 7-8-10 patternine uygun adversarial 6-lens review.
- H1+H7 atomic Mutex: match boyunca lock tutulur, ScheduledFix dokunulmaz — TOCTOU gerçekten kapalı mı?
- H2 ScheduleInconsistentError + into_inner poisoning recovery
- H3 spawn_blocking + chkdsk_volumes::collect
- H4 aria-busy/aria-disabled + re-entry guard
- H5 two AYRI sr-only live regions
- security_invariants.rs 9 test gate
- app-exit hook + UI cancel_session paralel deadlock?
- unreachable!() panik altında invariant?

Critical+High → Faz 3'e gel; medium+low Sprint 12.

### Faz 2 — H6 backend pending_chkdsks v2 (8h)

Schema migration `pending_chkdsk.json`:
- v1 (tek obje): `{"volume": "C", "scheduledAt": "...", "rebootPending": false}`
- v2 (Vec): `{"version": 2, "volumes": [{...}, ...]}`

Migration shim (`safety/pending_state.rs`):
- Önce v2 dene (`from_str::<PendingChkdskState>`)
- Fallback v1 tek-obje deneyerek wrap edip Vec yap
- Veri kaybı YOK invariant testi

Yeni komut: `query_pending_chkdsks() -> Vec<PendingChkdsk>` (eski `query_pending_chkdsk` shim olarak ilk öğeyi döndür)

`run_chkdsk_fix` artık `volumes` listesine **append** eder (mevcut listeyi ezmez).

`cancel_pending_chkdsk(volume)` yalnız o volume'ü çıkarır.

Multi-banner UI Sprint 12'ye — Sprint 11'de UI değişikliği YOK, yalnız backend migration. `ChkdskPendingBanner` ilk öğeyi göstermeye devam eder (geriye uyum).

CI: yeni `security_invariants` testi — migration shim v1 verisi okunduğunda volume korunur.

### Faz 3 — T-ext partial + D-ext paralel (6h)

**T-ext partial**:
- `HistoryDialog` "Geçmiş" / "Trend" tab toggle (mevcut listeyi koruyacak şekilde)
- Trend tab: tüm finding code'larını listele, sparkline yanında "kötüleşiyor" hint
- "3 hafta üst üste critical" basit kural — son 3 7-günlük pencere critical sayısı yükseliyorsa `<Badge variant="destructive-soft">Trend ⬆</Badge>`
- 4 yeni i18n key: `historyTabHistory`, `historyTabTrend`, `trendWorseningHint`, `trendNoCriticalCodes`

Standalone panel + multi-rule alerting Sprint 12.

**D-ext xs** (paralel):
- `collectors/pagefile.rs` PowerShell scripti `Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum` ekle
- `PsPagefileBundle.physical_memory_capacity_mb: Option<u64>` field
- Backend fallback: ham kapasite varsa onu `total_ram_mb` olarak kullan, yoksa Win32_ComputerSystem değerine düş (mevcut)
- 1-2 unit test

**As-discovered UX-kritik medium** Faz 1 review'undan gelen 2-3 free-win.

## Çiğnenemez invariantlar

- Sprint 6-10 tüm invariantlar
- `security_invariants.rs` 9 test + Sprint 11'de **+1 (migration shim veri kaybı yok)**
- pending_state.rs Settings'ten AYRI dosya kuralı (invariant #17)
- v1 verisi v2'ye migrate edilirken volume kaybı YASAK
