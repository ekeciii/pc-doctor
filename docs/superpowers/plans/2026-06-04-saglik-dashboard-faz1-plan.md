# Faz 1 İmplementasyon Planı — Sağlık Dashboard + Düzeltme Çatısı

- **Tarih:** 2026-06-04
- **Spec:** `docs/superpowers/specs/2026-06-04-saglik-dashboard-duzeltme-design.md`
- **Kapsam:** Faz 1 — FixTier çatısı + sağlık skoru + premium dashboard + `run_fix_all`
  (mevcut 4 Auto fix bağlı) + Guided mekanizması + Advisory gösterimi. **Yeni fix'ler (Faz 2+)
  bu planda DEĞİL.**
- **İlkeler:** mümkün olan yerde önce test; küçük commit'ler; her milestone sonunda
  `npm run check:all` yeşil; tüm güvenlik invariantları korunur; kişisel dosyaya dokunma yok.
- **Dal:** `feat/health-dashboard-phase1` (repo artık git).

## Milestone 1 — Backend: FixTier + Sağlık Skoru (saf mantık)

**1.1 `FixTier` enum + `Finding.fix_tier`** — `models.rs`'e `enum FixTier { Auto, Guided,
Advisory }` (serde camelCase) ekle; `Finding`'e `fix_tier: FixTier` alanı (default `Advisory`)
+ `with_fix_tier()` builder. `code_only` constructor default Advisory atar.
- _Doğrulama:_ `cargo build` + mevcut testler geçer.

**1.2 Mevcut bulguları katmana ata** — Auto: cleanup (disk_full), sfc, defender, chkdsk.
Guided: pagefile/updates/startup/security(dns,hosts)/drivers (zaten "ayarı aç" yapıyorlar).
Advisory: smart, thermal, event_log, crash_history, security(firewall/uac → Faz 2'de Auto'ya
yükselecek, şimdilik Guided).
- _Dosyalar:_ `diagnostics/*.rs`
- _Doğrulama:_ kategori başına tier'ı doğrulayan birim test.

**1.3 Sağlık skoru modülü** — yeni `src-tauri/src/health/{mod,score}.rs`:
`compute_health(&[Finding]) -> HealthScore { score: u8, band: Band, verdict_code: String,
breakdown: Vec<CategoryPenalty> }`. Saf fonksiyon. Critical −25 / Warning −8 / Info −2,
kategori tavanı −30, `clamp(0..=100)`. `lib.rs`'e `mod health;`.
- _Doğrulama:_ birim testler — boş→100, tek critical, kategori tavanı, taban clamp (0), karışık.

**1.4 Skoru tarama sonucuna ekle** — `ScanReport`'a `health: HealthScore` ekle; `commands.rs::scan`
hesaplayıp döndürsün (tek kaynak, test edilebilir).
- _Doğrulama:_ `cargo test --lib` yeşil; scan `health` döner.

## Milestone 2 — Backend: `run_fix_all` Orkestratörü

**2.1 Batch DTO'ları** — `models.rs`: `FixItemResult { id, ok, message_code }`,
`FixAllOutcome { applied, failed, reboot_required: Vec<...>, restore_created: bool }`.

**2.2 `run_fix_all` komutu** — frontend Auto bulgu id+action listesi gönderir.
(a) **tek** restore point, (b) **bir kez** elevation kontrolü (`NEEDS_ELEVATION`),
(c) sırayla mevcut remediation fonksiyonlarını çağır (`execute_cleanup`,
`run_system_file_check`, `run_defender_quick_scan`, `run_chkdsk_fix`), (d) per-item sonuç,
(e) reboot gerektirenleri ayrı gruba al. `lib.rs::invoke_handler`'a kaydet.
- _Doğrulama:_ gruplama/sıralama birim testi (mock); `cargo test`.

**2.3 Güvenlik** — yeni dış komut yok (mevcutları sarmalar); `security_invariants.rs`
değişmez. Yine de Fix-All'ın restore-point-önce sırasını doğrulayan bir test eklenir.

## Milestone 3 — Frontend: Tipler + Skor + Dashboard İskeleti

**3.1 Tipler + API** — `types.ts`: `FixTier`, `HealthScore`/`Band`, `Finding.fixTier`,
`ScanReport.health`. `api.ts`: `runFixAll(...)` wrapper + `toError` yönlendirmesi.

**3.2 Skor bileşenleri** — `HealthScoreRing.tsx` (animasyonlu SVG halka, banda göre OKLCH
renk, sayaç animasyonu, `prefers-reduced-motion`), `ScoreBreakdown.tsx` ("neden bu skor").

**3.3 `Dashboard.tsx`** — yeni üst düzey düzen: hero skor + "Hepsini Düzelt" CTA (Auto sayısı,
yoksa pasif) + "TARA"/"Yeniden Tara". `App.tsx` gövdesi bununla değişir (header + mevcut
dialoglar korunur).
- _Doğrulama:_ `npm run build`.

## Milestone 4 — Frontend: Kategori Grid + Tier-Farkındalıklı Kartlar + Guided Drawer

**4.1 `CategoryTile` + `CategoryGrid`** — 13 kategori, bulgulardan türeyen OK/Uyarı/Kritik rozeti.

**4.2 `IssueCard`** — `FindingCard`'dan evrilir; tier'a göre aksiyon: Auto→"Düzelt",
Guided→"Nasıl?", Advisory→"Detay". Detay çekmecesi + trend sparkline korunur.

**4.3 `GuidedFixDrawer`** — i18n adımları + "ayarı aç" (mevcut `OpenUrl`/`OpenSystemProperties`).
Faz 1: mekanizma + zaten-guided kategorilerin içeriği.
- _Doğrulama:_ `npm run build`.

## Milestone 5 — Frontend: Fix-All Akışı

**5.1 `FixAllConfirmDialog`** — yapılacaklar listesi + "restore point oluşturulacak" notu.
**5.2 `FixAllProgressDialog`** — `run_fix_all` sonucundan madde madde durum.
**5.3 `FixAllSummary`** + reboot-gerektiren grubu mevcut chkdsk reboot akışına devreder.
- _Doğrulama:_ `npm run build`.

## Milestone 6 — i18n, Entegrasyon, Test, Kapı

**6.1 i18n** — tüm yeni UI string'leri `tr.ts` (SSoT) + `en.ts`; `npm run check:i18n`.
**6.2 Skor tazeleme** — fix sonrası "yeniden tara" ile skor gerçekten güncellenir (sahte yok).
**6.3 Test kapısı** — `cargo test --lib` + `cargo test --test security_invariants` + `npm run check:all` yeşil.
**6.4 Manuel doğrulama** — `npm run tauri dev`: tara → skoru gör → bir bulguda Fix-All tetikle → skor tazelensin.

## Commit / PR Stratejisi

- `feat/health-dashboard-phase1` dalı; milestone başına commit; Faz 1 yeşilken PR aç.

## Kapsam Dışı (Faz 2+)

- Yeni Auto fix'ler (başlangıç öğesi devre dışı, pagefile sistem-yönetimli, firewall/UAC aç,
  Windows Update kur, sürücü araması) — her biri kendi spec/plan turunda. Bu planda yalnızca
  bunların gireceği **çatı** kurulur.
