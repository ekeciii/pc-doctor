# Changelog

Bu proje [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) formatını ve
[Semantic Versioning](https://semver.org/)'ı takip eder.

Sprint bazlı geliştirme geçmişi (Sprint 1-15) artık burada tutuluyor — ayrıntılı
sprint tasarım dokümanları için bkz. `docs/sprints/` (bkz. o klasördeki README).

## [Unreleased]

Bu bölüm, `v0.1.0`'dan bu yana `main`'e giren ve henüz etiketlenmemiş
değişiklikleri listeler. Lansman sırasında `[0.2.0] - <tarih>` olarak
yeniden adlandırılacak.

### Added
- Yerel AI sohbet asistanı ([Ollama](https://ollama.com), yalnız
  `127.0.0.1:11434` — internete çıkmaz). Tarama özetini açıklar, hiçbir eylem
  çalıştırmaz.
- Büyük/kullanılmayan dosya bulucusu — seçilen dosyaları **Geri Dönüşüm
  Kutusu'na** taşır (kalıcı silmez).
- 15 yeni tanı paneli (pagefile, güvenlik, Defender, sıcaklık, güncellemeler,
  sürücüler, çökme geçmişi, başlangıç, olay günlüğü, disk bütünlüğü, disk
  sağlığı, AI çekmecesi, dosya bulucu, Hepsini Düzelt ilerlemesi, chkdsk
  sonuç diyaloğu).
- `PRIVACY.md` + `docs/KVKK-AYDINLATMA.md` + `EULA.md` — veri işleme
  açıklaması, KVKK Aydınlatma Metni, kullanım koşulları. NSIS kurulumu artık
  bir onay sayfası gösteriyor.
- İlk açılışta bir kez gösterilen veri-okuma bildirimi + AI çekmecesinde
  ayrı bir veri-akışı bildirimi.
- `THIRD-PARTY-NOTICES.md` — bağımlılık lisans denetimi özeti.
- Sürüm tek-komut senkronizasyonu: `node scripts/bump-version.mjs <X.Y.Z>` +
  `scripts/check-version.mjs` (artık `check:all`'ın ilk adımı).
- `cargo fmt` / `cargo clippy -D warnings` / `prettier` artık CI gate'i.
- `cargo audit` release gate'ine eklendi (önceden yalnız PR kontrolünde).
- Governance dosyaları: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SUPPORT.md`, issue/PR şablonları, `dependabot.yml`, `CODEOWNERS`.

### Changed
- **Lisans: özel "Tescilli" lisanstan MIT'e geçildi.** Proje artık gerçek
  anlamda açık kaynak.
- `chkdsk` TOCTOU (start-gate yarış durumu) ve powershell/chkntfs pipe-deadlock
  düzeltmeleri (büyük çıktılarda sessizce veri kaybı riski vardı).
- 8 derleme uyarısının tamamı temizlendi (kullanılmayan `RebootScheduler` mock
  altyapısı, ölü sentinel/builder'lar).

### Fixed
- **İngilizce locale'de bulgu kartları Türkçe öneri metni gösteriyordu**
  (`recommended_action` locale'e bakmadan backend'den geçiyordu). 39 bulgu
  varyantı kod-tabanlı çeviriye taşındı.
- "11 kategori" diyen eski metinler "13 kategori" olarak düzeltildi (gerçek
  sayıyla eşleşti).
- 12 yerde ham hata mesajı yerine `toError()` sentinel ayrıştırması
  kullanılmaya başlandı (NeedsElevation/RestoreFailed gibi sentinel'lerin
  kullanıcıya ham string olarak sızmaması için).

### Security
- Windows Defender/güvenlik ayarları paneli için `github.com`'un `open_oem_link`
  allowlist'ine eklenmesi (yalnız Gizlilik/EULA linklerini açmak için).
- `Cargo.lock` artık takip ediliyor — reproducible build + anlamlı
  `cargo audit`.

## [0.1.0] - 2026-06-04

İlk yayın. 13 tanı kategorisi, çalışan Tauri auto-updater (minisign imzalı),
GitHub Pages üzerinde landing sayfası.

### Added
- Tanı kategorileri: disk doluluğu, disk sağlığı (SMART), disk bütünlüğü
  (chkdsk), olay günlüğü, sürücüler, virüs/Defender, donanım sıcaklığı,
  güvenlik konfigürasyonu, bekleyen güncellemeler, başlangıç performansı,
  çökme/donma geçmişi, sanal bellek (pagefile), temizlik fırsatları.
- Onarım akışları: allowlist tabanlı güvenli temizlik, otomatik Sistem Geri
  Yükleme noktası, `sfc`/`DISM` streaming onarımı, çok-volume farkında
  `chkdsk` `/scan` + `/f`, Defender Hızlı Tarama, "Hepsini Düzelt"
  orkestrasyonu.
- Sağlık skoru (0-100) dashboard'u + kategori grid'i.
- Tarama geçmişi (SQLite) + detay çekmecesi + trend sekmesi.
- TR/EN i18n (TR SSoT, derleme-zamanı parite kontrolü), karanlık/açık tema.
- Ayarlar ekranı, `tauri-plugin-updater` ile otomatik güncelleme (minisign
  imzalı, GitHub Releases üzerinden).
- Elevation gate (`is_elevated` + `relaunch_as_admin`) — admin gerektiren
  komutlar `NeedsElevation` sentinel'i döner.
- GitHub Actions CI (i18n + güvenlik invariant testleri + birim testler +
  frontend build) + release workflow.
- Landing sayfası (GitHub Pages).

[Unreleased]: https://github.com/ekeciii/pc-doctor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ekeciii/pc-doctor/releases/tag/v0.1.0
