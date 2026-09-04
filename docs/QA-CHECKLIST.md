# v0.2.0 Lansman Öncesi Elle Test Betiği (Faz 8a)

Bu betik `npm run check:all`'ın (statik) doğrulayamadığı şeyleri kapsar: gerçek
bir kurulum, gerçek bir UAC prompt'u, gerçek bir reboot. **Temiz** Windows 10 ve
Windows 11 VM'lerinde (önceki bir PC Doctor kurulumu olmayan) çalıştırılmalı —
tercihen ikisi de, en azından biri release öncesi zorunlu.

Her madde bir checkbox. Bir madde başarısız olursa: dosya/satır referansıyla not
al, `v0.2.0` etiketini atmadan önce düzelt veya bilinçli olarak ertele (ve
neden erteldiğini burada/CHANGELOG'da yaz).

İlgili: [RELEASING.md](./RELEASING.md) (imzalama + tag akışı), [CODESIGN.md](./CODESIGN.md)
(SignPath), [PRIVACY.md](../PRIVACY.md) (ilk açılış bildirimi metni).

## 0. Ortam

- [ ] Windows 10 VM — temiz, önceki PC Doctor kurulumu yok, Ollama **kurulu değil**.
- [ ] Windows 11 VM — temiz, önceki PC Doctor kurulumu yok, Ollama **kurulu** + en az bir model çekilmiş.
- [ ] Her ikisinde de test edilecek sürüm: imzalı MSI + imzalı NSIS (bkz. Faz 4b/4c — SignPath tamamlanmadan bu betik "imzasız" ikili ile de bir kez çalıştırılabilir, ama release'i bloklayan asıl koşu imzalı ikili ile olmalı).

## 1. Kurulum

- [ ] **MSI** kurulumu (VM #1): çift tıkla → SmartScreen davranışını not al (uyarı yok / "Daha fazla bilgi" adımı var / hiç görünmedi). Yayıncı adı doğru gösteriliyor mu (`tauri.conf.json` → `bundle.publisher`, SignPath sertifika subject'iyle eşleşmeli).
- [ ] Start menüsünde "PC Doctor" doğru ikonla görünüyor (placeholder değil).
- [ ] Add/Remove Programs'ta yayıncı + sürüm doğru.
- [ ] **NSIS** kurulumu (VM #2, ayrı makine): aynı kontroller — kurulum sihirbazı dili (TR/EN sistem locale'ine göre), lisans sayfası (`EULA.txt`) gösteriliyor ve içeriği okunabilir.

## 2. İlk açılış

- [ ] Uygulama ilk açılışta UAC prompt'u istiyor (yönetici gerektiren app).
- [ ] UAC sonrası **ilk-açılış bildirim modalı** (`FirstRunDisclosure`) çıkıyor — 4 madde + tam metne link okunabilir durumda.
- [ ] "Anladım, devam et" → modal kapanıyor.
- [ ] Uygulamayı kapat/yeniden aç → modal **bir daha çıkmıyor** (`disclosure_ack_version` persist doğrulaması).
- [ ] AI çekmecesini ilk kez aç → ayrı AI-rıza banner'ı çıkıyor, onaylayınca bir daha çıkmıyor.

## 3. Tarama

- [ ] TARA butonuna bas → **13 kategori** için sonuç dönüyor (Disk, Disk sağlığı, Disk bütünlüğü, Sanal bellek, Virüs, Güvenlik, Sürücü, Olay günlüğü, Çökme geçmişi, Başlangıç, Güncelleme, Donanım, Temizlik).
- [ ] Hiçbir bulgu kartında ham IPC/Rust hata string'i **yok** (ör. `Err(...)`, `"ShellExecuteW failed"` gibi ingilizce/teknik sızıntı) — her şey `resolveFinding` üzerinden geçmiş okunabilir TR metin.
- [ ] Ayarlar'dan dili **English**'e çevir, TARA'yı tekrar çalıştır → her bulgu kartında **İngilizce öneri metni** görünüyor (Faz 3c regresyon kontrolü — `recommendation_code` boşluğu artık kapalı; özellikle SMART/güvenlik/termal/başlangıç/çökme kategorilerinden birkaçını elle aç).

## 4. Tekil düzeltme akışları

- [ ] **Firewall aç** (bir profil kapalıyken): onay diyaloğu → restore point oluşturma denemesi → firewall açılıyor → bulgu kart listesinden düşüyor.
- [ ] **UAC aç**: onay → reboot-gerekli grubu doğru gösteriliyor (sessizce reboot **atılmıyor**, kullanıcı onayı bekleniyor).
- [ ] **Pagefile → sistem-yönetimli**: onay → reboot-gerekli grubuna giriyor.
- [ ] **sfc/DISM**: ilerleme çubuğu canlı akıyor (donmuyor), bitince özet (`SfcDismSummary`) doğru gösteriliyor.
- [ ] **Defender hızlı tarama**: ilerleme + sonuç (tehdit bulunursa/bulunmazsa) doğru.

## 5. Temizlik

- [ ] Restore point **başarılı** senaryo: temizlik onayı → restore point oluşuyor → hedefler temizleniyor → sonuç özeti doğru.
- [ ] Restore point **başarısız** senaryo (VSS servisini durdur veya System Protection'ı kapat): kurtarma banner'ı çıkıyor → "restore point olmadan devam et" seçeneği çalışıyor.
- [ ] **Hepsini Düzelt** batch'i (birden fazla Auto-tier bulgu varken): tek restore point (birden fazla değil), tek elevation prompt'u, reboot-gerektiren öğeler doğru grupta.

## 6. chkdsk

- [ ] Sistem-dışı (ör. D:) bir sürücüde `/f` **canlı** çalıştır → ilerleme akıyor → sonuç.
- [ ] Sistem sürücüsünde (C:) `/f` çalıştır → **zamanlanmış** (autochk, sonraki reboot) olarak işleniyor, `pending_chkdsk.json`'a yazılıyor.
- [ ] Zamanlanmış chkdsk'i **iptal et** → hem `chkntfs /x` exclude hem `shutdown /a` reboot-iptali gerçekten uygulanıyor mu (yalnızca UI state'i değil — reboot'u gerçekten tetikleyip iptalin tuttuğunu doğrula, veya en azından `chkntfs` çıktısını kontrol et).

## 7. Büyük dosya bulucu + silme (Geri Dönüşüm Kutusu)

- [ ] Korumalı bir yol altında (ör. `C:\Windows`, kullanıcı profili sistem dosyaları) dosya seçmeyi dene → reddediliyor veya listede hiç görünmüyor.
- [ ] Kullanıcı profili altında zararsız gerçek bir test dosyası seç → sil → onay diyaloğu **"Geri Dönüşüm Kutusu'na taşınacak"** diyor (kalıcı silme ifadesi yok).
- [ ] Sildikten sonra Windows Geri Dönüşüm Kutusu'nu aç → dosya **orada ve geri yüklenebilir** durumda.

## 8. AI sohbet

- [ ] VM #1 (Ollama kurulu değil): AI çekmecesini aç → düzgün "Ollama kurulu değil / bulunamadı" durumu gösteriliyor, **çökme yok**.
- [ ] VM #2 (Ollama kurulu + model var): bir soru sor → yanıt stream olarak akıyor, kesilmiyor/donmuyor.

## 9. Updater

- [ ] Ayrı bir VM'ye (veya aynı VM'nin snapshot'ından) **v0.1.0**'ı kur, biraz kullan (bir tarama çalıştır, geçmişe bir kayıt düşsün).
- [ ] `v0.2.0` release'i yayınlandıktan sonra uygulamayı aç → güncelleme banner'ı çıkıyor → "İndir ve kur" → `v0.2.0` kuruluyor.
- [ ] Güncelleme sonrası: Ayarlar, tarama geçmişi (`history.db`), `pending_chkdsk.json` (varsa) **sağ salim** — `com.egeyu.pcdoctor` identifier'ı değişmediği için `%APPDATA%` verisi korunmalı.

## 10. Kaldırma

- [ ] MSI ile kurulanı Add/Remove Programs'tan kaldır → temiz (kalıntı kayıt defteri anahtarı/kısayol yok).
- [ ] NSIS ile kurulanı kaldır → aynı kontrol.

---

**Sonuç kaydı:** her koşu için tarih + Windows sürümü + imzalı/imzasız ikili +
başarısız maddelerin listesini bu dosyanın altına (veya bir GitHub Issue'ya) ekle.
