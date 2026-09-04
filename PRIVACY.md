# PC Doctor — Gizlilik Politikası / Privacy Policy

*Son güncelleme / Last updated: 2026-09-04*

Bu belge iki dilde yazılmıştır — Türkçe bölüm KVKK Aydınlatma Metni'nin de
temelidir (ayrıca bkz. [docs/KVKK-AYDINLATMA.md](./docs/KVKK-AYDINLATMA.md)).

================================================================================
TÜRKÇE
================================================================================

## Özet

PC Doctor, bilgisayarınızda **tamamen yerel** çalışan bir Windows tanı/onarım
aracıdır. Hiçbir sunucumuz yok; taradığınız hiçbir veri bilgisayarınızdan
**bize** ulaşmaz. Tek ağ trafiği, uygulamanın kendisini güncel tutmak için
GitHub'a atılan bir sorgudur (aşağıda açıklanıyor).

## Veri Sorumlusu

**Ege Yücel** (GitHub: [@ekeciii](https://github.com/ekeciii)) — bu projenin
tek geliştiricisi ve telif hakkı sahibi. İletişim: bir
[GitHub issue](https://github.com/ekeciii/pc-doctor/issues) açarak.

PC Doctor'ın kendine ait bir sunucusu, veritabanı veya bulut hizmeti
**yoktur** — dolayısıyla "veri sorumlusu" burada yalnızca yazılımın nasıl
davrandığından sorumludur; kullanıcı verisini toplayan/işleyen bir üçüncü
taraf sistem yoktur.

## Cihazınızda okunan veri kategorileri ve nedenleri

TARA butonuna bastığınızda, uygulama Windows'un kendi araçlarıyla (WMI,
PowerShell, Win32 API) aşağıdaki ~13 kategoride bilgi toplar. Hepsi
**RAM'de işlenir ve ekranda gösterilir**; aksi belirtilmedikçe diske
yazılmaz:

| Kategori | Ne okunur | Neden |
|---|---|---|
| Disk doluluğu | Sürücü boş/dolu alan oranı | Depolama sorunu tespiti |
| Disk sağlığı (SMART) | Aşınma, sıcaklık, SMART durumu | Fiziksel disk arızası erken uyarısı |
| Disk bütünlüğü | NTFS hata sayaçları | Dosya sistemi sağlığı |
| Olay günlüğü | Son 7 gün kritik/hata olayları (**yalnız sağlayıcı+ID+sayı+tarih — mesaj içeriği ASLA okunmaz**) | Donanım/sürücü sorunu tespiti |
| Sürücüler | Yüklü sürücü listesi + tarihleri | Güncel olmayan/imzasız sürücü tespiti |
| Virüs/Defender | Windows Defender durumu | Koruma açık mı kontrolü |
| Donanım sıcaklığı | Termal sensörler, CPU throttling | Aşırı ısınma tespiti |
| Güvenlik konfigürasyonu | Firewall/UAC/BitLocker/DNS/hosts durumu | Temel güvenlik açığı tespiti |
| Bekleyen güncellemeler | Windows Update + winget listesi | Güvenlik yaması eksikliği |
| Başlangıç performansı | Açılış süresi + başlangıç programları | Yavaş açılış nedeni |
| Çökme/donma geçmişi | WER rapor sayısı + en sık kaynak adı | Kararsızlık paterni tespiti |
| Sanal bellek (pagefile) | Boyut/kullanım/hazırda bekletme | Bellek yapılandırma sorunu |
| Büyük/kullanılmayan dosyalar | **Tam dosya yolları** (isteğe bağlı, ayrı bir panelde) | Disk alanı açma |

**Önemli:** Büyük-dosya bulucusu tam dosya yollarını gösterir çünkü hangi
dosyayı sileceğinize siz karar veriyorsunuz — ama bu yollar **tarama
geçmişine yazılmaz**, yalnız o anki ekranda görünür.

## Tarama geçmişi

Ayarlar'dan açabileceğiniz "Tarama geçmişi" özelliği, her taramanın **özet
sayılarını** (bulgu sayısı, en yüksek şiddet seviyesi, tarih) yerel bir SQLite
dosyasına kaydeder: `%APPDATA%\com.egeyu.pcdoctor\history.db`. Bu dosyaya
dosya yolu, kullanıcı adı, tehdit adı veya olay günlüğü mesaj içeriği **asla
yazılmaz** — kod tabanında bunu zorunlu kılan bir filtre katmanı
(`sanitize_params`) ve otomatik test paketi var. Saklama süresini (1-3650
gün) Ayarlar'dan değiştirebilir veya geçmişi tek tıkla tamamen
silebilirsiniz.

## Yerel AI asistanı (opsiyonel)

PC Doctor, ayrıca kurmanız gereken [Ollama](https://ollama.com) ile yerel bir
sohbet asistanı sunar. Sohbeti açtığınızda, tarama özetiniz (sağlık skoru,
bulgu başlıkları/kategorileri/şiddetleri, sürücü kullanım oranları — dosya
yolu veya olay mesajı **değil**) bilgisayarınızda ayrı çalışan Ollama
sürecine (`127.0.0.1:11434`) gönderilir. Bu istek bilgisayarınızın dışına
**hiç çıkmaz**. Ollama kurulu değilse özellik kullanılamaz durumda kalır,
hiçbir veri gönderilmez.

## Ağ trafiği (tam liste)

PC Doctor'ın yaptığı **tek** dış ağ isteği, uygulama açıldığında sessizce
çalışan güncelleme kontrolüdür: `github.com` üzerinden en son sürüm bilgisini
sorgular. Bu, hangi PC Doctor sürümünü kullandığınızı GitHub'a (dolayısıyla
IP adresiniz üzerinden) bildirir — tipik bir yazılım güncelleme kontrolünün
ötesinde bir veri paylaşımı yoktur. Landing sayfamızda (GitHub Pages) veya
uygulama içinde hiçbir analytics/izleme kodu çalışmaz.

## Telemetri

**Yok.** PC Doctor kullanım istatistiği, hata raporu veya herhangi bir
davranışsal veriyi toplamaz ya da göndermez.

## Hukuki dayanak ve haklarınız (KVKK)

Tüm işlem cihazınızda yerel olarak yürütüldüğü ve kişisel verileriniz bize
aktarılmadığı için, KVKK anlamında bir "veri işleme" faaliyeti bu yazılımın
**kendisi tarafından** gerçekleştirilmez — veriniz üzerindeki kontrol tamamen
sizde kalır (silme, saklama süresi, hangi kategoriyi tarayacağınız). Ayrıntılı
Aydınlatma Metni için: [docs/KVKK-AYDINLATMA.md](./docs/KVKK-AYDINLATMA.md).

## İletişim

Sorularınız için: [GitHub Issues](https://github.com/ekeciii/pc-doctor/issues).

================================================================================
ENGLISH
================================================================================

## Summary

PC Doctor is a Windows diagnostic/repair tool that runs **entirely locally**
on your machine. We operate no servers; nothing you scan ever reaches **us**.
The only network traffic is a request to GitHub to check for app updates
(explained below).

## Data Controller

**Ege Yücel** (GitHub: [@ekeciii](https://github.com/ekeciii)) — the sole
developer and copyright holder of this project. Contact: open a
[GitHub issue](https://github.com/ekeciii/pc-doctor/issues).

PC Doctor has no server, database, or cloud service of its own — so there is
no third-party system collecting or processing user data; the "data
controller" here is only responsible for how the software itself behaves.

## Data categories read on your device, and why

When you press SCAN, the app gathers information across ~13 categories using
Windows' own tools (WMI, PowerShell, Win32 APIs). All of it is **processed
in memory and shown on screen**; unless stated otherwise, none of it is
written to disk. See the Turkish section above for the full category table —
it applies identically in English. Notably: the large/unused-file finder
shows **full file paths** (so you can decide what to delete) but those paths
are never written to scan history, only shown on screen at that moment.

## Scan history

The optional "Scan history" feature stores each scan's **summary counts**
(finding count, highest severity, date) in a local SQLite file:
`%APPDATA%\com.egeyu.pcdoctor\history.db`. File paths, usernames, threat
names, or event-log message bodies are **never** written there — enforced by
a code-level filter (`sanitize_params`) and an automated test suite. You can
change the retention period (1–3650 days) or clear history entirely from
Settings.

## Local AI assistant (optional)

PC Doctor offers an optional local chat assistant via
[Ollama](https://ollama.com), which you install separately. When you open the
chat, your scan summary (health score, finding titles/categories/severities,
drive usage ratios — **not** file paths or event messages) is sent to the
Ollama process running on your own machine (`127.0.0.1:11434`). This request
**never leaves your computer**. If Ollama isn't installed, the feature is
simply unavailable — nothing is sent.

## Network traffic (complete list)

The **only** outbound network request PC Doctor makes is a silent update
check on launch: it queries `github.com` for the latest release info. This
tells GitHub (and therefore, via your IP) which PC Doctor version you're
running — no more data sharing than a typical software update check. No
analytics or tracking code runs on our landing page (GitHub Pages) or in the
app.

## Telemetry

**None.** PC Doctor does not collect or send usage statistics, crash reports,
or any behavioral data.

## Legal basis and your rights

Because all processing runs locally on your device and no personal data is
transferred to us, this software does not itself perform a "data processing"
activity in the GDPR/KVKK sense — control over your data (deletion,
retention period, which categories to scan) stays entirely with you.

## Contact

Questions: [GitHub Issues](https://github.com/ekeciii/pc-doctor/issues).
