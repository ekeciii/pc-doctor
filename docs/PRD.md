# PC Doctor — Ürün Gereksinim Belgesi

## Amaç
Teknik bilgisi olmayan kullanıcının PC'sindeki problemleri (donma, yavaşlık,
bozuk driver, virüs, disk doluluğu, sistem dosyası hasarı, RAM/disk arızası
sinyalleri) tek tıkla tespit edip, kullanıcıya açıklayıp, onayı sonrası
otomatik düzelten bir Windows masaüstü uygulaması.

## Hedef kullanıcı
- Teknik bilgisi sıfır kullanıcı: "PC'm donuyor" diyebilen ama Event Viewer
  açmayı bilmeyen kişi
- İkincil: kendi PC'sine bakan teknisyen (advanced mode)

## Teknoloji yığını
- Frontend: Tauri 2 + React + TypeScript + TailwindCSS + shadcn/ui
- Backend: Rust (sistem çağrıları için) + PowerShell/WMI sarmalayıcıları
- AI motoru: **yerel [Ollama](https://ollama.com)** (`127.0.0.1:11434`, opsiyonel —
  kurulu değilse özellik pasif). Bulut tabanlı bir sağlayıcı (örn. Anthropic Claude
  API) hiç kullanılmadı — kullanıcı "AI istemiyorum" dedi, sonradan yalnızca yerel/
  gizli bir asistan olarak eklendi.
- Local DB: SQLite (rusqlite bundled)
- Paket yöneticisi: npm (pnpm planlandı, mevcut sistemde corepack admin gerektirdiği için npm'e dönüldü)
- Build: Tauri bundler → `.msi` + NSIS `.exe` installer

## Mimari katmanlar
1. **Collector katmanı** (Rust): WMI, Registry, Performance Counters, Event Log,
   SMART verileri, sürücü listesi, kurulu programlar, başlangıç öğeleri, ağ
   adaptörleri, sıcaklık sensörleri okuyucuları.
2. **Diagnostics katmanı**: Toplanan veriden kural tabanlı + AI destekli analiz.
3. **Remediation katmanı**: Her tanı için "düzeltme planı" (atomik adımlar listesi).
4. **Execution katmanı**: Sistem değişikliği yapmadan ÖNCE System Restore noktası oluştur.
5. **UI katmanı**: 3 ekran — Dashboard / Scan / Report.

## Olmazsa olmaz özellikler (MVP)

### Tanı kategorileri

MVP'de planlanan 12 kategoriden başlandı; şu an **13 kategori** üretimde
(bkz. [README.md](../README.md#mevcut-özellikler) — güncel liste): disk
doluluğu, disk sağlığı (SMART), disk bütünlüğü (chkdsk), olay günlüğü,
sürücüler, virüs/Defender, donanım sıcaklığı, güvenlik konfigürasyonu,
bekleyen güncellemeler, başlangıç performansı, çökme/donma geçmişi, sanal
bellek (pagefile), temizlik fırsatları.

### UX prensipleri
- Tek "TARA" butonu; bulgular KRİTİK/UYARI/İYİ renkli kartlarda.
- Her bulguda Detay + DÜZELT.
- Her düzeltme öncesi System Restore.
- Geri al paneli.
- TR/EN i18n + karanlık/açık tema.

## Güvenlik kuralları (ÇİĞNENEMEZ)
- ASLA registry'de bilinmeyen alanlara yazma.
- ASLA system32 altında dosya silme.
- ASLA driver kurma (sadece link).
- ASLA kişisel veri okuma.
- **Telemetri yok** (opt-in bayrağı bile eklenmedi — hiçbir kullanım verisi toplanmıyor/gönderilmiyor).
- AI'ya giden veri zaten PII içermez (yalnız sağlık skoru + bulgu başlıkları/kategori/şiddet + sürücü kullanım oranları — dosya yolu/olay mesajı yok) ve yalnız yerel Ollama sürecine (127.0.0.1) gider.
- Her sistem değiştirici eylem için System Restore noktası zorunlu.

## Yol haritası (tarihsel — gerçek gidişat için [CHANGELOG.md](../CHANGELOG.md))

Aşağıdaki ilk taslak yol haritasıydı; gerçek uygulama farklı ilerledi (Claude
API hiç entegre edilmedi, code-signing henüz yapılmadı — bkz.
[CODESIGN.md](./CODESIGN.md), kategori sayısı 13'e çıktı). Sprint 2 sonrası
ayrıntılı gidişat için `docs/sprints/` (Sprint 12'ye kadar) ve
`CHANGELOG.md` (sonrası) bakın.

- **Sprint 1**: Tauri iskeleti + Disk sağlığı + Disk doluluğu + Temp temizleme + System Restore.
- **Sprint 2**: Event Log + sfc/DISM + Driver inventory. (Planlanan Claude API entegrasyonu iptal edildi — kullanıcı "AI istemiyorum" dedi; yerine Sprint 15'te yerel/opsiyonel bir Ollama asistanı eklendi.)
- **Sprint 3**: Başlangıç öğeleri + Pagefile + Defender + Geri al paneli + TR yerelleştirme.
- **Sprint 4**: Auto-update + Landing page. (Code-signing bu sprintte değil, lansman hazırlığında SignPath.io OSS ile planlandı.)
