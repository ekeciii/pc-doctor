# Sağlık Dashboard'u + Bütünsel Düzeltme — Tasarım Dokümanı

- **Tarih:** 2026-06-04
- **Durum:** Onaylandı (brainstorm), implementasyon planı bekliyor
- **Yaklaşım:** B — premium iskelet + düzeltme mimarisi önce, yeni fix'ler kategori kategori

## 1. Bağlam ve Problem

Mevcut PC Doctor 13 tanı kategorisi tarıyor, ama yalnız **4'ü gerçekten düzeltiyor**
(disk temizliği, sfc/DISM, chkdsk, Defender). Kalan 9 kategori (sürücüler,
güncellemeler, başlangıç öğeleri, güvenlik konfigürasyonu, sıcaklık, SMART, sanal
bellek, olay günlüğü, çökme geçmişi) yalnızca **tespit edip** Windows ayar sayfasına
veya OEM linkine yönlendiriyor — sorunu kendisi çözmüyor. Üstelik gerçek düzeltmelerin
çoğu admin gerektiriyor; dev modunda (yetkisiz) "yönetici gerekli" dönüyor.

**Kullanıcı geri bildirimi:** "Sorunları sadece tespit ediyor, çözmüyor — tek gördüğüm
disk temizliği yapıyor. Tasarım üst düzey olsun, ilgi çeksin."

**Hedef:** (a) her sorunun riske uygun bir çözümü olsun, (b) ana ekran premium bir
sağlık-skoru dashboard'u olsun ki app "kullanışlı" ve "dikkat çekici" hissettirsin.

### Brainstorm kararları

- **Kapsam:** bütünsel — işlevsellik + görsel birlikte.
- **Düzeltme duruşu:** riske göre karışık — güvenle geri alınabilenler tek tık otomatik
  (onay + restore point), riskliler rehberli, donanımsal olanlar yalnız bilgilendirme.
- **Görsel:** üst düzey, dikkat çekici ("vay be" dedirten).
- **Ana deneyim:** 0–100 sağlık skoru + "Hepsini Düzelt" dashboard'u.

## 2. Düzeltme Katmanı Mimarisi (backend)

Her `Finding` kendi **düzeltme katmanını** ilan eder. Yeni `FixTier` enum:

- `Auto` — app değişikliği kendisi yapar (onay + restore point + geri alınabilir).
- `Guided` — app doğru yeri açar + adım adım talimat gösterir; değişikliği kullanıcı yapar.
- `Advisory` — yalnız bilgi, aksiyon yok (donanım / log).

`Finding`'e `fix_tier: FixTier` alanı eklenir; mevcut `FindingAction`'dan türetilebilir
(geriye uyumlu). Mevcut 4 düzeltme `Auto` etiketlenir.

### `run_fix_all` orkestratörü (yeni Tauri komutu)

1. Tüm `Auto` bulguların aksiyonlarını toplar.
2. **Tek** System Restore noktası oluşturur (fix başına değil).
3. Gerekiyorsa **bir kez** elevation ister.
4. Her fix'i sırayla çalıştırır; mevcut tekil komutları (`execute_cleanup`,
   `run_system_file_check`, `run_defender_quick_scan`, `run_chkdsk_fix`, …) yeniden kullanır.
5. Her fix'in sonucu ayrı yakalanır — biri patlarsa diğerleri devam eder; sonunda
   "5'ten 4'ü düzeltildi" özeti.
6. **Reboot gerektirenler** (pagefile, chkdsk /f) ayrı gruba alınır; sessizce yeniden
   başlatma YOK — kullanıcı bilinçli zamanlar (mevcut chkdsk reboot + `pending_state` altyapısı).

Fix-All, tekil komutların **üstünde** bir katmandır; onları çoğaltmaz.

## 3. Sağlık Skoru Modeli (0–100)

Deterministik ve açıklanabilir; saf fonksiyon, birim test edilebilir.

**Bulgu başına ceza:** Critical −25, Warning −8, Info −2, Good/bulgu yok 0.

**Kategori başına tavan −30:** tek bir kategori skoru tek başına yere seremez (gürültülü
olay günlüğü baskın olmaz).

**Skor = clamp(100 − Σ min(kategori_cezası, 30), 0, 100)**

**Renk bantları** (OKLCH semantic token'lar): 90–100 yeşil "Mükemmel", 70–89 teal
"İyi durumda", 40–69 amber "Dikkat gerekiyor", 0–39 kırmızı "Kritik".

**Verdict:** en kötü severity + sayımdan tek satır (örn. "3 kritik, 2 uyarı — dikkat
gerekiyor" / "Her şey yolunda").

**Skor kırılımı ("neden bu skor?"):** hangi kategorinin kaç puan götürdüğünü gösteren liste.

**Kategori kutuları:** her kategori en kötü bulgusuna göre OK / Uyarı / Kritik rozeti + sayı.

> Kategori ağırlıklandırma eklenmez — severity zaten ağırlığı taşır (arızalı disk zaten
> Critical üretir). Basit ve açıklanabilir kalır.

## 4. Premium Dashboard Arayüzü

Mevcut tasarım dili korunur (OKLCH token'lar, Bricolage Grotesque başlık / Plus Jakarta
gövde / Geist Mono sayı, CVA primitive'ler, dark/light). Düzen, yukarıdan aşağı:

1. **İnce header** — marka, tema toggle, ayarlar, geçmiş.
2. **Hero / skor bölgesi** — büyük animasyonlu dairesel skor halkası (SVG; tarama bitince
   0→skor sayaç + yay), ortada iri rakam, altında verdict. Yanında ana CTA **"Hepsini
   Düzelt"** (sayı gösterir; otomatik fix yoksa pasif) + ikincil "Yeniden Tara". Tarama
   öncesi: boş halka + ortada "TARA".
3. **Kategori kutuları (grid)** — 13 tile (ikon + ad + rozet + sayı); tıkla → o kategoriye in.
4. **Öncelikli sorun listesi** — ciddiyete göre sıralı kartlar; katmana göre aksiyon:
   `Auto`→ "Düzelt", `Guided`→ "Nasıl?" (rehber çekmecesi), `Advisory`→ "Detay".
   Genişleyen detay + trend sparkline (mevcut bileşenler).
5. **Fix-All yüzeyleri** — onay modalı (yapılacaklar listesi + "restore point oluşturulacak"),
   ilerleme overlay'i (madde madde durum), sonuç özeti, "yeniden başlatma isteyen" grup.

**Premium dokunuşlar:** skor halkası sayaç+yay animasyonu, kartların kademeli girişi, tile
hover yükselmesi, skora tepki veren ince arkaplan tonu (yeşil↔kırmızı); `prefers-reduced-motion`
saygılı. Jenerik "AI dashboard" görünümünden kaçınılır — kimlik skor halkası + renge tepki
veren zemin + özenli tipografi.

**Yeni/değişen bileşenler:** `Dashboard`, `HealthScoreRing`, `ScoreBreakdown`,
`CategoryTile`/`CategoryGrid`, tier-farkındalıklı `IssueCard` (FindingCard'dan evrilir),
`FixAllConfirmDialog`/`FixAllProgressDialog`/`FixAllSummary`, `GuidedFixDrawer`. ui/
primitive'leri, mevcut dialoglar, trend sparkline, `resolveFinding`/`metricLabel` yeniden kullanılır.

## 5. Kategori → Katman Haritası ve Fazlama

| Kategori | Katman | Düzeltme | Faz |
|---|---|---|---|
| Disk temizliği | Auto | Temp/cache sil *(mevcut)* | 1 |
| Sistem dosyaları | Auto | sfc/DISM *(mevcut)* | 1 |
| Disk bütünlüğü | Auto (reboot) | chkdsk /scan·/f *(mevcut)* | 1 |
| Virüs/Defender | Auto | Quick scan *(mevcut)* | 1 |
| SMART / Sıcaklık / Olay günlüğü / Çökme | Advisory | Bilgi (donanım/log) | 1 |
| Başlangıç öğeleri | Auto | Yavaşlatan öğeyi devre dışı bırak (geri alınabilir) | 2 |
| Sanal bellek | Auto (reboot) | Sistem-yönetimli yap | 2 |
| Güvenlik (firewall/UAC) | Auto | Firewall / UAC aç | 2 |
| Güvenlik (DNS/hosts) | Guided | Doğru ayarı aç + anlat | 2 |
| Güncellemeler | Auto | Windows Update kur tetikle | 2 |
| Sürücüler | Guided | WU sürücü araması / OEM link | 2 |

**Faz 1 (bu spec'in inşası):** FixTier çatısı + `Finding.fix_tier` + skor modeli +
`ScoreBreakdown` + premium dashboard bileşenleri + `run_fix_all` orkestrasyonu (mevcut 4
Auto fix bağlı) + `GuidedFixDrawer` mekanizması + Advisory kategorilerin gösterimi.

**Faz 2+:** her yeni fix kendi remediation modülü + birim testleri + i18n anahtarları +
`security_invariants.rs` bekçisiyle çatıya takılır (başlangıç öğesi, pagefile, firewall/UAC,
Windows Update, sürücü). Her biri ayrı plan/implementasyon turu.

## 6. Hata Akışları

- **Elevation:** Fix-All admin gerektiren fix görürse **tek** "yönetici olarak başlat"
  istemi (mevcut `NEEDS_ELEVATION` kalıbı), sonra devam.
- **Restore point başarısız:** tüm batch için **tek** nokta; başarısızsa "geri yükleme
  olmadan devam et?" kurtarma banner'ı (force). Varsayılan: iptal.
- **Fix izolasyonu:** biri patlarsa batch durmaz; özet madde madde OK/hata + sebep.
- **Reboot grubu:** pagefile + chkdsk /f sessizce yeniden başlatmaz; "yeniden başlatma
  isteyen" grubuna alınır, kullanıcı zamanlar.
- **Skoru sahteleme yok:** düzeltmelerden sonra "yeniden tara" ile skor gerçekten tazelenir.

## 7. Test Stratejisi

- **Backend birim:** skor formülü (bantlar, kategori tavanı, clamp); FixTier türetimi;
  `run_fix_all` mock orkestrasyon (başarı/hata/reboot karışımı).
- **Güvenlik:** her yeni Faz 2 komutu için `tests/security_invariants.rs` bekçisi.
- **i18n:** yeni anahtarlar `npm run check:i18n` ile doğrulanır.
- **Bütünsel kapı:** `npm run check:all`.
- **Manuel:** app'i çalıştır, bir bulguda Fix-All tetikle, skor tazelemesini doğrula.

## 8. Korunan Güvenlik İlkeleri

Kişisel dosyaya dokunma yok; sistem değişikliği öncesi restore point zorunlu; admin gate;
geri alınabilirlik; yeni komutlar sentinel + arg-whitelist + System32 hardcoded path
kalıplarını izler; mevcut çiğnenemez invariantlar (fsutil/bcdedit/BootExecute yasak,
chkdsk `/x` yasak, chkntfs `/d` yasak, …) aynen geçerli.

## 9. Kapsam Dışı (YAGNI)

- AI/öneri motoru yok (kullanıcı açıkça istemiyor).
- Kategori ağırlıklandırma yok (severity yeterli).
- Telemetri yok.
- Faz 2 fix'lerinin implementasyon detayları bu spec'te değil — her biri kendi turunda.

## 10. Açık Sorular / Riskler

- Faz 2 "Auto" fix'lerinin (pagefile sistem-yönetimli, firewall/UAC aç, başlangıç devre
  dışı, WU kur) güvenli yöntemi (WMI/PowerShell/COM) ve geri-alınabilirliği her biri için
  kendi planında netleştirilecek; riskli çıkanlar `Guided`'a düşürülebilir.
- "Hepsini Düzelt" çok sayıda fix + reboot karışımında UX akışı (özellikle reboot grubu)
  implementasyonda kullanıcı testiyle doğrulanmalı.
