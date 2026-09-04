# PC Doctor — Kullanım Koşulları / Terms of Use

*Son güncelleme / Last updated: 2026-09-04*

Bu belge kurulum sırasında gösterilir. Lisans koşulları için ayrıca
[LICENSE](./LICENSE) (MIT), veri işleme için [PRIVACY.md](./PRIVACY.md)
geçerlidir.

================================================================================
TÜRKÇE
================================================================================

## Ne yaptığını bil

PC Doctor, Windows sistem ayarlarını değiştirebilen ve yönetici (admin)
yetkisiyle çalışan bir bakım aracıdır. Kurulumu ve kullanımı, aşağıdaki
koşulları kabul ettiğiniz anlamına gelir.

## Yönetici yetkisiyle çalışan işlemler

Bazı düzeltmeler (Sistem Geri Yükleme noktası oluşturma, `sfc`/`DISM`
onarımı, `chkdsk /f`, güvenlik duvarı/UAC açma, sayfa dosyası ayarı) yönetici
yetkisi ister ve **her seferinde ayrı onayınızı** ister. Bunlardan hiçbiri
sizin açık onayınız olmadan çalışmaz.

## Yıkıcı/geri dönüşü zor işlemler — bilerek kullan

- **`chkdsk /f`** dosya sistemi onarımı yapar; sistem sürücüsünde yeniden
  başlatma gerektirir ve nadiren de olsa onarım sırasında veri kaybı riski
  taşır (disk zaten bozuksa). Her `chkdsk /f` öncesi bir Sistem Geri Yükleme
  noktası oluşturulur (başarısız olursa açıkça onayınızla atlanabilir).
- **Büyük/kullanılmayan dosya bulucusu**, seçtiğiniz dosyaları **Geri
  Dönüşüm Kutusu'na taşır** (kalıcı silmez) — yanlış seçtiğiniz dosyaları
  oradan geri alabilirsiniz. Geri Dönüşüm Kutusu'nu boşaltırsanız bu dosyalar
  kalıcı olarak silinir.
- **Temizlik fırsatları** (Temp, Windows Update önbelleği vb.) yalnızca
  önceden tanımlı, güvenli klasör hedeflerinde çalışır; bu hedeflerin
  köklerini değil, yalnızca içeriğini siler.
- **Sistem ayarı değişiklikleri** (UAC, güvenlik duvarı, sayfa dosyası)
  yalnızca güvenliği **güçlendirme** yönünde çalışır — hiçbir otomatik fix
  bir korumayı kapatmaz.

## Garanti reddi

Yazılım **"OLDUĞU GİBİ"** sunulur, açık veya zımni hiçbir garanti
olmaksızın (bkz. [LICENSE](./LICENSE) MIT metni). PC Doctor'ın hiçbir
düzeltmesi mükemmel/hatasız garanti edilmez. Kritik verilerinizi düzenli
yedeklemeniz önerilir — özellikle disk onarımı gibi işlemler öncesi.

## Profesyonel tamir yerine geçmez

PC Doctor teşhis ve rutin bakım için tasarlanmıştır; ciddi donanım arızası
(örn. SMART kritik uyarısı) veya veri kurtarma senaryolarında profesyonel
teknik servise başvurmanızı öneririz.

## Değişiklikler

Bu koşullar sürüm güncellemeleriyle değişebilir; önemli değişiklikler
[CHANGELOG.md](./CHANGELOG.md)'de belirtilir.

================================================================================
ENGLISH
================================================================================

## Know what it does

PC Doctor is a maintenance tool that can change Windows system settings and
runs with administrator privileges. Installing and using it means you accept
the terms below.

## Operations requiring admin privileges

Some fixes (creating a System Restore point, `sfc`/`DISM` repair,
`chkdsk /f`, enabling the firewall/UAC, pagefile configuration) require
admin rights and ask for **your explicit confirmation every time**. None of
them run without your consent.

## Destructive / hard-to-reverse operations — use knowingly

- **`chkdsk /f`** repairs the file system; on the system drive it requires a
  reboot and, rarely, carries a data-loss risk during repair if the disk was
  already corrupted. A System Restore point is created before every
  `chkdsk /f` (can be explicitly skipped with your confirmation if it
  fails).
- The **large/unused-file finder** moves the files you select **to the
  Recycle Bin** (not a permanent delete) — you can restore mistaken
  selections from there. Emptying the Recycle Bin deletes them permanently.
- **Cleanup targets** (Temp, Windows Update cache, etc.) only operate on
  predefined, safe folder targets, and only remove their contents, never the
  root folders themselves.
- **System setting changes** (UAC, firewall, pagefile) only ever
  **strengthen** security — no automatic fix ever disables a protection.

## Disclaimer of warranty

The software is provided **"AS IS"**, without warranty of any kind, express
or implied (see [LICENSE](./LICENSE), MIT text). No PC Doctor fix is
guaranteed to be perfect or error-free. Regular backups of important data
are recommended, especially before disk-repair operations.

## Not a substitute for professional repair

PC Doctor is designed for diagnostics and routine maintenance; for serious
hardware failure (e.g. a critical SMART warning) or data-recovery scenarios,
we recommend consulting a professional technician.

## Changes

These terms may change with version updates; significant changes are noted
in [CHANGELOG.md](./CHANGELOG.md).
