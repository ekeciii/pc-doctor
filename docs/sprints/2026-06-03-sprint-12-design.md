# Sprint 12 — Multi-Volume UX Teslimi + Sprint 11 Hardening

**Tarih**: 2026-06-03
**Effort**: ~22 saat (3 gün), 4 faz
**Kapsam**: 4-lens workflow + sentez

## Amaç

Sprint 11'in 6 high fix'i review olmadan production'a çıkamaz; Sprint 11 backend (`query_pending_chkdsks`, `append`, `remove`) UI'da tamamlanmadan kullanıcıya görünmüyor. `cancel_live_only` take/match/put_back pattern test edilmemiş — invariant test invariant değildir.

## Dahil

| Aday | Faz | Effort | Risk |
|------|-----|--------|------|
| **L11** Sprint 11 hardening review | 1 | small | medium |
| **H6-UI** Multi-volume banner Vec render | 2 | small | low |
| **D-test** cancel_live_only race test | 2 (paralel) | xs | low |
| **K-ext partial** 3 pilot detector metric_code | 3 | medium | low |
| **M-batch2 subset** i18n + focus + dead code | 4 | small | low |

## Ertelenen (Sprint 13+)

- **T-ext full** standalone trend panel + alerting motoru — yeni domain (scheduling, rule engine, false-positive risk); design notu gerek
- **K-ext kalan 10 detector** — pilot pattern doğrulandıktan sonra toplu

## Faz planı

### Faz 1 (gün 1 sabah) — L11 hardening review (5h)

Sprint 7-8-10-11 patternine uygun 6-lens adversarial.
- H1+H4 banner wire + persistent Alert + required prop: ScheduleInconsistentError handler doğru mu?
- H2 single `cancel_session()` rollback: schedule_cleared=false durumunda doğru error mesajı?
- H3 `list_fixed_ntfs_drive_letters`: parse_query A-Z bypass var mı?
- H5 `scan_findings_trend_batch`: IN clause 100 cap + code regex; SQL injection?
- Sprint 11 H6 backend migration shim: v1 verisi kaybı invariant test geçiyor mu?

Critical+High → uygula; medium+low Sprint 13.

### Faz 2 (gün 1 öğleden sonra → gün 2 sabah) — H6-UI + D-test paralel (7h)

**H6-UI**:
- `ChkdskPendingBanner` artık `Vec<PendingChkdsk>` render
- Her volume için ayrı Alert kartı + "Şimdi reboot" / "İptal" / "Sonra" butonlar
- Multi-volume UX: kullanıcı C: ve D: ayrı pending görür, bağımsız aksiyon
- `queryPendingChkdsks` mount'ta çağrılır (eski `queryPendingChkdsk` shim kalır)
- 2 yeni i18n key (`chkdskPendingMultiTitle`, `chkdskPendingMultiBody`)

**D-test** (paralel — backend dokunmuyor):
- `tests/security_invariants.rs` veya yeni `tests/cancel_live_only_race.rs`
- `thread::scope` ile concurrent `cancel_live_only` + `put_session` deneyi
- `CURRENT_SESSION` Mutex held boyunca ScheduledFix variantının kaybolmaması assertion
- `security_invariants.rs` 9 → 10 test

### Faz 3 (gün 2 öğleden sonra) — K-ext partial pilot (6h)

`models.rs` yeni enum:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MetricCode {
    TemperatureCelsius { value: f64 },
    Percentage { value: f64 },
    Bytes { value: u64 },
    Count { value: u32 },
    Days { value: i64 },
    BareString { text: String },
}
```

`Finding` struct yeni alan:
```rust
pub metric_code: Option<MetricCode>,  // Backwards compat: mevcut `metric: String` korunur
```

Pilot 3 detector refactor:
- `thermal.rs` — `TemperatureCelsius { value }` emit; mevcut `format!("{:.0}°C", ...)` metric String alanı backwards compat için kalır
- `pagefile.rs` — `Percentage` ve `Bytes` variantları
- `disk_full.rs` — `Percentage`

Frontend `metricLabel.ts` — `metric_code` varsa locale-aware render, yoksa eski `metric` String fallback.

Pattern doğrulandı → Sprint 13'te kalan 10 detector.

### Faz 4 (gün 3) — M-batch2 kritik subset (4h)

1. **i18n missing keys compile-time regression test** — `tr.ts` SSoT, `en.ts` `Record<TKey, string>` exhaustive zaten var; ek olarak tests/integration: tüm `t("...")` çağrıları codebase'de TKey tanımlı mı? (basit grep + TKey compare)
2. **Dialog focus restore edge cases** — Sprint 7'de eklenen focus restore pattern + Sprint 10 review H4 aria-busy; nested dialog open close stack test
3. **ChkdskMode dead enum sil** + **cancel_scan backward-compat shim sil** (Sprint 10'da `#[allow(dead_code)]` ile bastırıldı, K-ext pilot öncesi temizle)

Sprint kapanış: smoke test 5 senaryo + memory update.

## Çiğnenemez invariantlar

- Sprint 6-11 tüm invariantlar korunur
- `security_invariants.rs` 9 → 10 test (cancel_live_only race + invariant #22 ScheduledFix korunur)
- K-ext: mevcut `metric: String` alanı KALIR (backwards compat); `metric_code` opsiyonel
- L11 fixleri review onayı YOK iken Faz 2-4 başlamaz
