// Finding code dictionary (TR) — Sprint 7 complete migration.
// 13 kategori için tüm Backend Finding emit'leri code+params yapısında.
// PII whitelist: yalnız vendor/numeric/sabit-kategori params. Path → %USERPROFILE%.
// SSoT: `as const` → `FindingCode` keys'ten türer. findings.en.ts exhaustive.

export const findingsTr = {
  // === Sprint 6: Pagefile ===
  "finding.pagefile.undersized.title": "Sanal bellek (pagefile) yetersiz",
  "finding.pagefile.undersized.description":
    "Manuel olarak ayarlanmış pagefile boyutu ({configuredMb} MB) RAM'iniz ({ramMb} MB) için tavsiye edilen 1.5×RAM eşiğinin (en az {recommendedMb} MB) altında. Büyük programlarda 'yetersiz bellek' hataları görebilirsiniz.",
  "finding.pagefile.undersized.action": "Sistem-yönetimli yap",

  "finding.pagefile.consider_managed.title": "Sanal belleği sistem yönetebilir",
  "finding.pagefile.consider_managed.description":
    "{ramGb} GB RAM'iniz var ve pagefile manuel ayarlı. Bu boyutta RAM için sistem yönetimine bırakmak hem performans hem disk kullanımı açısından daha pratik.",
  "finding.pagefile.consider_managed.action": "Sistem-yönetimli yap",

  "finding.pagefile.high_usage.title": "Pagefile yoğun kullanımda (%{usagePercent})",
  "finding.pagefile.high_usage.description":
    "Pagefile'ın peak kullanımı ayrılan alanın %{usagePercent}'una ulaşmış ({peakMb} MB / {allocatedMb} MB). Bu sistemin sürekli swap yaptığını işaret edebilir — daha fazla RAM veya daha büyük pagefile gerekebilir.",
  "finding.pagefile.high_usage.action": "Sanal Bellek Ayarlarını Aç",

  "finding.pagefile.hibernation_disk_pressure.title":
    "Hazırda bekletme (hibernation) disk yer kaplıyor",
  "finding.pagefile.hibernation_disk_pressure.description":
    "Sistem diskinde sadece %{freePercent} boş yer kalmış. hiberfil.sys dosyası {hiberfilMb} MB ({ramMb} MB RAM kadar). Masaüstü PC'de hibernation'a sık ihtiyaç duymuyorsanız kapatarak yer kazanabilirsiniz.",
  "finding.pagefile.hibernation_disk_pressure.action": "Komutu kopyala",

  // === Sprint 6: chkdsk ===
  "finding.chkdsk.errors_detected.title":
    "Son 30 günde sistemde {errorCount} disk/NTFS hatası tespit edildi",
  "finding.chkdsk.errors_detected.description":
    "Olay günlüğünde disk veya NTFS sürücüsüne ait {errorCount} hata kaydedildi. Önerilen ilk tarama hedefi: {volume}: sürücüsü. chkdsk /scan dosya sistemini taramayı önerip donmaları azaltabilir. Bu sadece tarama — düzeltme yapmaz, veriniz risk altında değil.",
  "finding.chkdsk.errors_detected.action": "chkdsk Taraması Başlat",

  // === Sprint 7: disk_full ===
  "finding.disk_full.full.title": "{mount} sürücüsü dolu (%{freePercent} boş)",
  "finding.disk_full.full.description":
    "Disk neredeyse tamamen dolu. Sistem performansı düşebilir; güncellemeler yüklenemeyebilir. Geri kalan: {freeFormatted}.",
  "finding.disk_full.warning.title": "{mount} sürücüsünde az yer kaldı (%{freePercent} boş)",
  "finding.disk_full.warning.description":
    "Disk doluluk eşiğine yaklaşıyor. Geri kalan: {freeFormatted}.",
  "finding.disk_full.info.title": "{mount} sürücüsünde yer ayırmaya başla (%{freePercent} boş)",
  "finding.disk_full.info.description":
    "Şu an kritik değil ama büyük güncellemeler/oyunlar için alan sıkışıyor. Geri kalan: {freeFormatted}.",

  // === drivers === (Faz 2 kalibrasyon: per-driver gürültüsü kaldırıldı, toplu)
  "finding.driver.unsigned_summary.title": "{count} imzasız sürücü",
  "finding.driver.unsigned_summary.description":
    "Bu sürücülerin dijital imzası doğrulanamadı. Güvenilir sürümleri Windows Update üzerinden kontrol edin.",
  "finding.driver.unsigned_summary.action": "Windows Update'i aç",
  "finding.driver.outdated_summary.title": "{count} sürücü uzun süredir güncellenmemiş",
  "finding.driver.outdated_summary.description":
    "3+ yıldır güncellenmemiş sürücüler. Genelde sorun değildir; Windows Update'te yeni sürüm olup olmadığına bakabilirsiniz.",
  "finding.driver.outdated_summary.action": "Windows Update'i aç",

  // === Sprint 7: defender ===
  "finding.defender.active_threats.title": "Defender'da {threatCount} aktif tehdit",
  "finding.defender.active_threats.description":
    "Aktif veya engellenmemiş tehdit tespiti var. Hızlı tarama çalıştır.",
  "finding.defender.active_threats.action": "Hızlı Tarama Başlat",
  "finding.defender.rt_off.title": "Defender gerçek zamanlı koruma KAPALI",
  "finding.defender.rt_off.description":
    "Microsoft Defender'ın gerçek zamanlı koruması devre dışı. PC virüslere karşı savunmasız.",
  "finding.defender.rt_off.action": "Hızlı Tarama Başlat",
  "finding.defender.av_off.title": "Antivirüs devre dışı",
  "finding.defender.av_off.description":
    "Defender antivirüs motoru kapalı. Başka bir AV kuruluysa onun durumunu kontrol et.",
  "finding.defender.tamper_off.title": "Defender tamper koruması KAPALI",
  "finding.defender.tamper_off.description":
    "Tamper Protection devre dışı. Kötü amaçlı yazılım Defender ayarlarını değiştirebilir.",
  "finding.defender.tamper_off.action": "Windows Güvenlik'i Aç",
  "finding.defender.sig_stale.title": "Defender imza veritabanı {ageDays} gündür güncellenmemiş",
  "finding.defender.sig_stale.description":
    "Yeni tehditleri yakalayabilmek için imzaların güncel olması gerek.",
  "finding.defender.sig_stale.action": "Windows Update'i Aç",
  "finding.defender.scan_stale.title": "Son Hızlı Tarama {ageDays} gün önce",
  "finding.defender.scan_stale.description":
    "Düzenli tarama yapmıyorsan, gerçek zamanlı korumayı atlatan tehditler birikebilir.",
  "finding.defender.scan_stale.action": "Hızlı Tarama Başlat",

  // === Sprint 7: smart ===
  "finding.smart.health.title": "{diskName} sağlık uyarısı: {healthStatus}",
  "finding.smart.health.description":
    "Operasyonel durum: {operationalStatus}. Yedek al, üretici tanı aracını çalıştır.",
  "finding.smart.wear.title": "{diskName} SSD aşınma %{wearPercent}",
  "finding.smart.wear.description":
    "SSD'lerin yazılabilir ömrü sınırlıdır. %80 üstü değer SSD'nin son dönemine girdiğini gösterir.",
  "finding.smart.temperature.title": "{diskName} sıcaklığı yüksek: {temperatureC}°C",
  "finding.smart.temperature.description":
    "Disk sıcaklığı uzun süre 70°C üstünde olursa ömrü kısalır ve veri kaybı riski artar.",
  "finding.smart.io_errors.title": "{diskName} I/O hatası birikti",
  "finding.smart.io_errors.description":
    "Okuma hatası toplam: {readErrors}. Yazma hatası toplam: {writeErrors}. Disk bozulmaya başlıyor olabilir.",

  // === Sprint 7: thermal ===
  "finding.thermal.critical.title": "Donanım kritik düzeyde sıcak: {maxTemp}°C",
  "finding.thermal.critical.description":
    "ACPI termal sensörü ({zoneCount} zone) {maxTempPrecise}°C ölçtü. Bu seviyede CPU/GPU thermal throttling ve ömür kaybı kaçınılmaz. Not: sensör adı/yeri OEM'e göre değişir.",
  "finding.thermal.warning.title": "Donanım sıcaklığı yüksek: {maxTemp}°C",
  "finding.thermal.warning.description":
    "ACPI termal sensörü ({zoneCount} zone) {maxTempPrecise}°C ölçtü. Yük altında daha da artarsa throttling başlar.",
  "finding.thermal.throttling_critical.title":
    "CPU ağır throttling: nominal hızın %{perfPercent}'ı",
  "finding.thermal.throttling_critical.description":
    "CPU şu an %{loadPercent} yük altında ama baz hızının yalnızca %{perfPercent}'ında çalışıyor. Aşırı sıcaklık, güç limitleri veya BIOS profili sebep olabilir.",
  "finding.thermal.throttling_critical.action": "Güç ayarlarını aç",
  "finding.thermal.throttling_warning.title": "CPU hafif throttling: nominal %{perfPercent}",
  "finding.thermal.throttling_warning.description":
    "Yük %{loadPercent}, performans %{perfPercent} — baz hızın altında. Termal ya da güç limitleri etken olabilir.",
  "finding.thermal.throttling_warning.action": "Güç ayarlarını aç",

  // === Sprint 7: security_config ===
  "finding.security.firewall_query_failed.title": "Windows Güvenlik Duvarı durumu okunamadı",
  "finding.security.firewall_query_failed.description":
    "Get-NetFirewallProfile yanıt vermedi. MpsSvc servisi durmuş ya da WMI bozuk olabilir.",
  "finding.security.firewall_third_party.title":
    "{vendor} firewall aktif (Windows profilleri kapalı — normal)",
  "finding.security.firewall_third_party.description":
    "Windows Güvenlik Merkezi'ne göre {vendor} firewall etkin ve güncel. Bu yüzden Windows Defender Firewall profilleri ({profiles}) kapalı. 3. taraf güvenlik suite'i kullanıyorsan bu beklenen davranıştır.",
  "finding.security.firewall_off.title": "Windows Güvenlik Duvarı kapalı ({profiles})",
  "finding.security.firewall_off.description":
    "Windows Defender Firewall'un en az bir profili kapalı ve aktif bir 3. taraf firewall tespit edilmedi. Ağ saldırılarına karşı savunma katmanı eksik.",
  "finding.security.firewall_off.action": "Güvenlik duvarını aç",
  "finding.security.uac_off.title": "Kullanıcı Hesabı Denetimi (UAC) KAPALI",
  "finding.security.uac_off.description":
    "UAC devre dışı bırakılmış. Kötü amaçlı yazılım yönetici işlemlerini sormadan çalıştırabilir.",
  "finding.security.uac_off.action": "UAC'yi aç",
  "finding.security.uac_no_prompt.title": "UAC yöneticilere hiç sormuyor",
  "finding.security.uac_no_prompt.description":
    "ConsentPromptBehaviorAdmin=0 — yönetici hesaplar yetki yükseltirken hiç prompt görmüyor. UAC açık ama efektif değil.",
  "finding.security.bitlocker_off.title": "Sistem diski şifrelenmemiş (BitLocker kapalı)",
  "finding.security.bitlocker_off.description":
    "Laptop'un kaybolması/çalınması durumunda C: diskindeki dosyalar şifresiz olduğu için okunabilir. Pro/Enterprise'da BitLocker, Home'da Cihaz Şifrelemesi kullanılabilir.",
  "finding.security.bitlocker_off.action": "Cihaz şifrelemesini aç",
  "finding.security.dns_unknown.title":
    "{unknownCount} bilinmeyen DNS sunucusu",
  "finding.security.dns_unknown.description":
    "DNS sunucularından bazıları standart public DNS listesinin dışında. Bu kurumsal/ISP DNS olabilir (normal) ya da kötü amaçlı yazılımın DNS hijacking'i olabilir. Ağ ayarlarından kontrol et.",
  "finding.security.dns_unknown.action": "Ağ ayarlarını aç",
  "finding.security.hosts_suspicious.title":
    "hosts dosyasında {suspiciousCount} özel kayıt",
  "finding.security.hosts_suspicious.description":
    "Loopback olmayan satırlar var. Reklam engelleyici veya kötü amaçlı DNS hijack olabilir. Tanımadığın satırları C:\\Windows\\System32\\drivers\\etc\\hosts dosyasında kontrol et.",

  // === Sprint 7: updates ===
  "finding.updates.wu_security.title": "{count} kritik güvenlik güncellemesi bekliyor",
  "finding.updates.wu_security.description":
    "Microsoft güvenlik güncellemesi olarak işaretlenmiş bekleyen kayıtlar var.",
  "finding.updates.wu_security.action": "Windows Update'i aç",
  "finding.updates.wu_many.title": "{count} Windows güncellemesi bekliyor",
  "finding.updates.wu_many.description":
    "Birikmiş güncellemeler sistemin stabil ve güvenli kalmasını engelliyor.",
  "finding.updates.wu_many.action": "Windows Update'i aç",
  "finding.updates.wu_some.title": "{count} güncelleme mevcut",
  "finding.updates.wu_some.description":
    "Acil değil ama güncel kalmak için kurmanı öneririz.",
  "finding.updates.wu_some.action": "Windows Update'i aç",
  "finding.updates.winget.title": "{count} uygulama güncellenebilir (winget)",
  "finding.updates.winget.description":
    "Kurulu uygulamaların yeni sürümleri mevcut.",

  // === Sprint 7: startup ===
  "finding.startup.slow_critical.title": "Son açılış çok uzun: {seconds} saniye",
  "finding.startup.slow_critical.description":
    "Microsoft tanılama servisi son boot için {milliseconds} ms ({seconds}s) raporladı. 2 dakikadan uzun açılış belirgin bir sorundur.",
  "finding.startup.slow_critical.action": "Başlangıç uygulamalarını aç",
  "finding.startup.slow_warning.title": "Açılış yavaş: {seconds} saniye",
  "finding.startup.slow_warning.description":
    "Son boot süresi {milliseconds} ms ({seconds}s). 60 saniye altı ideal kabul edilir.",
  "finding.startup.slow_warning.action": "Başlangıç uygulamalarını aç",
  "finding.startup.too_many.title": "Çok fazla başlangıç öğesi ({count})",
  "finding.startup.too_many.description":
    "Windows başlatıldığında otomatik çalışan program sayısı yüksek. Açılışı ve sistemi yavaşlatabilir.",
  "finding.startup.too_many.action": "Başlangıç uygulamalarını aç",

  // === Sprint 7: crash_history ===
  "finding.crash.wer_many.title": "Son 30 günde {werCount} uygulama çökmesi",
  "finding.crash.wer_many.description":
    "Windows Error Reporting çok sayıda çökme/donma kaydı tutmuş. Belirli bir uygulamaya odaklıysa o uygulamayı güncelle/kaldır.",
  "finding.crash.wer_some.title": "Son 30 günde {werCount} çökme kaydı",
  "finding.crash.wer_some.description":
    "Düzenli ama az sayıda çökme. Belirli bir program ya da sürücü olabilir.",
  "finding.crash.top_signature.title":
    "'{source}' kaynaklı {signatureCount} kayıt (en sık)",
  "finding.crash.top_signature.description":
    "Reliability Monitor verisi son 30 günde en çok {signatureCount} kez bu kaynaktan rapor aldı. Son: {lastOccurred}.",

  // === Sprint 7: event_log ===
  "finding.event_log.kernel_power_41.title":
    "Beklenmedik kapanma ({count} kez son 7 günde)",
  "finding.event_log.kernel_power_41.description":
    "Donanım veya güç kesintisi sonrası Windows beklenmedik şekilde yeniden başlatıldı. Sistem dosyaları bozulmuş olabilir.",
  "finding.event_log.kernel_power_41.action": "Sistem dosyalarını onar",
  "finding.event_log.whea_or_bugcheck.title":
    "Donanım/BSOD belirtisi: {provider} ({count})",
  "finding.event_log.whea_or_bugcheck.description":
    "Windows Donanım Hata Mimarisi (WHEA) veya BugCheck olayı tespit edildi. RAM/CPU/disk düzeyinde donanım problemine veya driver hatasına işaret edebilir.",
  "finding.event_log.whea_or_bugcheck.action": "Sistem dosyalarını onar",
  "finding.event_log.gpu_driver_error.title": "GPU sürücü hatası ({count})",
  "finding.event_log.gpu_driver_error.description":
    "{gpuVendor} sağlayıcısı son 7 günde {count} kez hata kaydetti. GPU sürücüsünün eski veya bozuk olması muhtemel.",
  "finding.event_log.gpu_driver_error.action": "GPU sürücüsünü güncelle",
  "finding.event_log.disk_or_ntfs_error.title": "Disk/dosya sistemi hatası ({count})",
  "finding.event_log.disk_or_ntfs_error.description":
    "NTFS veya disk sürücüsü hata kaydetti. Disk bozuk sektör veya bağlantı problemine işaret edebilir.",
  "finding.event_log.disk_or_ntfs_error.action": "Sistem dosyalarını onar",
  "finding.event_log.application_crash.title": "Uygulama çökmesi/donması ({count})",
  "finding.event_log.application_crash.description":
    "Uygulamalar son 7 günde sık sık donuyor veya çöküyor. Belirli bir programa odaklıysa o programı güncelle veya kaldır.",
} as const;

export type FindingCode = keyof typeof findingsTr;
