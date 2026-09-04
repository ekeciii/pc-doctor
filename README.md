# PC Doctor

Windows için **tek tıkla** tanı ve onarım uygulaması. Tauri 2 + React 18 + TypeScript + TailwindCSS v4 (frontend) · Rust (backend).

Hedef kullanıcı: teknik olmayan bir Windows kullanıcısı. "TARA → sorunları gör → güvenle DÜZELT" akışı. Türkçe-öncelikli arayüz (i18n SSoT TR), tam İngilizce locale.

> Günlük geliştirme akışı için [DEVELOPMENT.md](./DEVELOPMENT.md), mimari + güvenlik invariantları için [CLAUDE.md](./CLAUDE.md), sürüm yayınlama için [docs/RELEASING.md](./docs/RELEASING.md).

## Mevcut özellikler

**13 tanı kategorisi** (tek taramada paralel çalışır):

| Kategori | Ne yapar |
| --- | --- |
| Disk doluluğu | Tüm sürücülerde boş alan oranı |
| Disk sağlığı (SMART) | Aşınma / sıcaklık / SMART durumu |
| Disk bütünlüğü (chkdsk) | NTFS hata sayacı (Get-Volume + Ntfs/disk olay günlüğü) |
| Olay günlüğü | Son 7 gün Kernel-Power/WHEA/GPU/disk/Ntfs/app hataları |
| Sürücüler | DriverDate > 2 yıl veya imzasız → OEM linki |
| Virüs/Defender | Aktif tehdit, imza/tarama tazeliği |
| Donanım sıcaklığı | Termal bölge + işlemci throttling (locale-nötr) |
| Güvenlik konfigürasyonu | Firewall / UAC / BitLocker / DNS / hosts |
| Bekleyen güncellemeler | Windows Update (COM API) + winget |
| Başlangıç performansı | Boot süresi + başlangıç öğeleri |
| Çökme/donma geçmişi | WER raporları + güvenilirlik kayıtları (son 30 gün) |
| Sanal bellek (pagefile) | Boyut / kullanım / hibernation disk baskısı |
| Temizlik fırsatları | %TEMP%, Windows\Temp, SoftwareDistribution, CBS, $WinREAgent, Recycle Bin |

**Onarım & güvenlik akışları:**

- Allowlist tabanlı güvenli temizlik (köklerin kendisi değil, yalnız doğrudan çocuklar; symlink/junction atlanır)
- Her sistem-değiştirici eylem öncesi otomatik **Sistem Geri Yükleme** noktası (başarısızsa kullanıcı onayıyla `force_without_restore`)
- `sfc /scannow` + `DISM /RestoreHealth` streaming onarım (Tauri event kanalı)
- **chkdsk** `/scan` (canlı) + `/f` (canlı non-system **veya** system disk için `chkntfs /c` autochk + reboot zamanlaması), multi-volume farkında banner'lar
- Defender Quick Scan
- Her DÜZELT için onay modali; elevation banner + "Yönetici olarak yeniden başlat"

**Platform & UX:**

- Tarama geçmişi (SQLite) + detay çekmecesi + trend sekmesi (sparkline)
- TR/EN i18n (TR SSoT, derleme-zamanı parite kontrolü), karanlık/açık tema (sistem tercihini takip eder)
- Ayarlar ekranı, otomatik güncelleme (tauri-plugin-updater)
- OKLCH semantic token tabanlı tasarım sistemi (`components/ui/` primitive katmanı)

## Ön koşullar

| Araç | Önerilen sürüm | Kontrol |
| --- | --- | --- |
| Node.js | ≥ 20 (24 doğrulandı) | `node --version` |
| npm | (Node ile gelir) | `npm --version` |
| Rust (rustup) | en güncel kararlı | `rustc --version` |
| Visual Studio C++ Build Tools | 2022 ("Desktop development with C++") | Visual Studio Installer |
| Windows | 10 build 19041+ / 11 | `winver` |

Rust yoksa: https://rustup.rs üzerinden `rustup-init.exe` indir → çalıştır → `rustup default stable`.

## Çalıştırma

```powershell
cd D:\pc-doctor
npm install
npm run tauri dev
```

> **Dev modunda UAC çıkmaz** ve exe normal kullanıcı olarak başlar. Manifest (`requireAdministrator`) yalnızca **release** derlemesine gömülür (`build.rs` `DEP_TAURI_DEV` kontrolü) — sebebi cargo'nun non-elevated shell'den elevated child spawnlayamaması (`OS error 740`). Admin gerektiren komutlar `NeedsElevation` döner; UI'da turuncu banner + "Yönetici olarak yeniden başlat" görürsün. Elevated akışları test etmenin iki yolu için [DEVELOPMENT.md](./DEVELOPMENT.md).

## Doğrulama

```powershell
npm run check:i18n   # TR/EN sözlük paritesi + t() çağrı doğrulaması
npm run check:all    # i18n + cargo invariants + cargo lib + frontend build
cargo test --lib                      # src-tauri/ içinde — birim testler
cargo test --test security_invariants # Güvenlik invariant CI bekçileri (10 test)
```

## Üretim derlemesi

```powershell
npm run tauri build
```

Çıktı: `src-tauri/target/release/bundle/` altında `.msi` (MSI) ve `.exe` (NSIS) installer. Release exe manifest gömülü olduğu için UAC ile başlar. Code-sign entegrasyonu: [docs/CODESIGN.md](./docs/CODESIGN.md).

## Klasör yapısı

```
src/                       React frontend
  components/              Feature componentleri (ScanButton, FindingCard, CleanupPanel,
                           Chkdsk* dialog/banner'ları, HistoryDialog, SettingsDialog, ...)
  components/ui/           CVA tabanlı primitive katmanı (Button, Card, Dialog, Badge, ...)
  lib/                     api.ts (invoke wrapper'ları + toError sentinel parse), types, settings, updater
  lib/i18n/                tr.ts (SSoT) + en.ts + findings.{tr,en}.ts + resolveFinding + metricLabel
src-tauri/
  manifest.xml             requireAdministrator + UTF-8 + DPI (yalnız release'de gömülür)
  build.rs                 DEP_TAURI_DEV ise manifest gömmez
  capabilities/            Tauri 2 capability/permission tanımları
  src/
    lib.rs / main.rs       App entry, plugin kaydı, RunEvent::Exit hook
    admin.rs               is_elevated + relaunch_as_admin + sentinel sabitleri
    commands.rs            Tauri komutları (history hariç)
    models.rs              Finding, MetricCode, ChkdskStatus, ... DTO'lar
    collectors/<kat>.rs    Saf veri toplama (WMI/PowerShell), tanı mantığı YOK
    diagnostics/<kat>.rs   Collector çıktısı → Vec<Finding> (eşik/severity kuralları)
    remediation/           cleanup, system_file_check, defender_scan, chkdsk, chkntfs,
                           reboot, chkdsk_boot_result, volume (paylaşılan regex)
    safety/                allowlist, restore_point, pending_state (chkdsk JSON)
    history/               SQLite (rusqlite bundled): schema, commands, retention
    util/                  powershell (zaman aşımlı PS spawn) + system (is_laptop OnceCell)
  tests/security_invariants.rs   Kaynak-tabanlı güvenlik CI bekçileri
docs/                      PRD.md, RELEASING.md, CODESIGN.md, sprints/
scripts/                   check-i18n.mjs, check-all.mjs
```

## Güvenlik notları

- **Allowlist dışı silme yok.** `safety::allowlist` her temizlik hedefinde uygulanır; symlink/junction takip edilmez; yalnız doğrudan çocuklar silinir (kökler korunur).
- **System Restore başarısız olursa** temizlik varsayılan iptal; UI'dan `force_without_restore = true` ile kullanıcı açıkça onaylayarak geçebilir.
- **PII koruması:** DB'ye dosya yolu, hostname, kullanıcı adı, tehdit adı veya olay günlüğü mesaj gövdesi yazılmaz. `diagnostics/util::sanitize_params` per-kategori allow-list son savunma hattıdır.
- **Çiğnenemez güvenlik invariantları** (örn. `fsutil dirty set` yasak, chkdsk `/x` yasak, chkntfs `/d` yasak, exe yolları System32 hardcoded) hem kod-review kuralı hem `tests/security_invariants.rs` CI bekçisidir. Tam liste: [CLAUDE.md](./CLAUDE.md#non-negotiable-security-invariants).
- **OEM/dış URL'ler** yalnız HTTPS + `ms-settings:` + `windowsdefender:` şemaları (`opener:allow-open-url` capability).

## İkon

`src-tauri/icons/icon.ico` ve `icon.png` ilk kurulumda placeholder olarak üretildi. Üretim için kendi logonuzla değiştirin:

```powershell
npx @tauri-apps/cli icon path\to\source-1024.png
```

## Lisans

**MIT Lisansı.** Telif Hakkı © 2026 Ege Yücel ([@ekeciii](https://github.com/ekeciii)).

Kaynak kod açık kaynaktır; MIT koşulları altında kopyalanabilir, değiştirilebilir
ve dağıtılabilir. Tam metin: [LICENSE](./LICENSE). Kullanılan üçüncü parti
bağımlılıkların lisansları için [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
