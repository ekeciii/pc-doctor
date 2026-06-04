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
- AI motoru: Anthropic Claude API (Sprint 2'den itibaren)
- Local DB: SQLite (Sprint 2'den itibaren)
- Paket yöneticisi: npm (pnpm planlandı, mevcut sistemde corepack admin gerektirdiği için npm'e dönüldü)
- Build: Tauri bundler → tek .msi installer

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
1. Disk sağlığı, 2. RAM, 3. CPU/GPU, 4. Driver durumu, 5. Sistem dosyası bütünlüğü,
6. Bekleyen güncellemeler, 7. Başlangıç performansı, 8. Disk doluluğu temizliği,
9. Pagefile/hibernation, 10. Malware ön taraması, 11. Event log analizi, 12. Donma/çökme tespiti.

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
- Telemetri OPT-IN, varsayılan KAPALI.
- AI'ya gönderilen veri anonimleştirilmiş.
- Her sistem değiştirici eylem için System Restore noktası zorunlu.

## Yol haritası
- **Sprint 1**: Tauri iskeleti + Disk sağlığı + Disk doluluğu + Temp temizleme + System Restore.
- **Sprint 2**: Event Log + sfc/DISM + Driver inventory + Claude API (Haiku).
- **Sprint 3**: Başlangıç öğeleri + Pagefile + Defender + Geri al paneli + TR yerelleştirme.
- **Sprint 4**: Code-signed MSI + Auto-update + Landing page.
