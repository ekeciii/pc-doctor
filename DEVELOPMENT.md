# Geliştirme Notları

> Bu belge ilk kurulum tamamlandıktan sonra **günlük çalışma** akışını anlatır.
> Kurulum için [README.md](./README.md) bölümlerine bak.

## Standart dev çalıştırma

**Normal (yetkisiz) PowerShell aç**, sonra:

```powershell
cd D:\pc-doctor
npm run tauri dev
```

- UAC promptu **çıkmamalı**. Pencere açılır, HMR çalışır.
- Vite `127.0.0.1:1420`'de dinler (IPv6 race sorunu yok).
- Rust kodunda değişiklik → cargo otomatik rebuild + restart.
- React/Tailwind değişikliği → tarayıcı otomatik HMR refresh.

### Neden admin değil?

`src-tauri/manifest.xml` `requireAdministrator` seviyesinde, ama
`src-tauri/build.rs` bu manifesti **yalnızca release derlemelerde** gömüyor
(dev'de `DEP_TAURI_DEV=true` olduğunda atlanıyor). Sebep: cargo'nun
non-elevated shell'den elevated child process spawnlayamaması (`OS error 740`).

Bu yüzden dev'de exe normal kullanıcı yetkisiyle başlar. Admin gerektiren
komutlar (System Restore, korumalı temizlik) `NeedsElevation` döner ve
UI'da turuncu banner + "Yönetici olarak yeniden başlat" butonu görürsün.

## Admin yetkisi gerektiren işleri test etmek

İki yol:

### 1. UI'dan elevation iste (gerçek kullanıcı akışı)

1. Normal dev modunda app'i aç.
2. Turuncu "Yönetici yetkisi önerilir" banner'ına bas **veya** bir DÜZELT
   tıklayınca tetiklenen "NeedsElevation" akışına git.
3. **"Yönetici olarak yeniden başlat"** butonu → UAC prompt → Evet.
4. Mevcut exe kapanır, yeni elevated instance Vite dev URL'sine bağlanır.

> Not: Bu modda elevated child cargo tarafından izlenmez. Vite'ı durdurursan
> veya kod değiştirirsen, elevated instance stale kalır. Düzgün rebuild için
> instance'ı kapat ve **admin terminalden** `npm run tauri dev` çalıştır.

### 2. Admin terminalden dev (geliştirici akışı)

Windows Terminal'i "Yönetici olarak çalıştır" ile aç, sonra:

```powershell
cd D:\pc-doctor
npm run tauri dev
```

Shell zaten elevated olduğu için cargo run rahatlıkla exe'yi başlatır,
ek UAC promptu çıkmaz, tüm admin komutları doğrudan çalışır.

## Release derlemesi

```powershell
cd D:\pc-doctor
npm run tauri build
```

- `src-tauri/target/release/pc-doctor.exe` — manifest gömülü (UAC ile başlar).
- `src-tauri/target/release/bundle/msi/PC Doctor_0.1.0_x64_en-US.msi` — installer.
- `src-tauri/target/release/bundle/nsis/PC Doctor_0.1.0_x64-setup.exe` — alternatif.

Sprint 4'te EV code-sign sertifikası alındığında signtool entegrasyonu
eklenecek (mevcut bundle imzasız).

## Tipik hata mesajları ve çözümleri

| Sorun | Sebep | Çözüm |
| --- | --- | --- |
| `OS error 740` cargo run sırasında | Manifest dev'de gömülmüş | build.rs'de `DEP_TAURI_DEV` kontrolü olmalı (zaten var). `cargo clean` ile yeniden derle. |
| `Could not connect to http://127.0.0.1:1420/ after 180s` | Vite `::1`'e bind etmiş | `vite.config.js` (stale derleme çıktısı) varsa sil. `node_modules\.vite` cache'ini temizle. |
| Pencerede "tauri.localhost refused the connection" | CSP eski / devUrl yanlış | `tauri.conf.json`'da devUrl `127.0.0.1` ve CSP'de `http://127.0.0.1:1420` whitelist'i olmalı. |
| Tarama yapıyor ama `cleanup` çalışmıyor / banner duruyor | Dev modda normal kullanıcısın | "Yönetici olarak yeniden başlat" → UAC → tekrar dene. |
| `cargo check` ağ hatası verirsek | crates.io yavaş bağlantı | `%USERPROFILE%\.cargo\config.toml` dosyasında `[http] timeout=120 low-speed-limit=1` var (kurulu). |

## Bellek tüketimi sürpriz: VS Build Tools 50 GB

İlk kurulumda VS Build Tools 2022 ~5-10 GB indirir, kurulum sonrası
C: sürücüsünde ~50 GB yer kaplar (MSVC + Windows SDK + .NET arşivleri).
Disk doluluk uyarıları için referans rakam.

## Stack için dış kaynaklar

- Tauri 2: https://v2.tauri.app/
- windows-rs (Win32 binding): https://github.com/microsoft/windows-rs
- WMI crate: https://github.com/ohadravid/wmi-rs (Sprint 2'de eklenecek)
- shadcn/ui (referans): https://ui.shadcn.com/
- Tauri 2 capabilities: `src-tauri/capabilities/default.json` — yeni plugin
  permission'ları buraya eklenir.

## Sprint 2 başlamadan önce

- `feedback_stack_choices` ve `project_pc_doctor` memory dosyaları güncel — yeni
  bir oturumda Claude bu bağlamı otomatik yükler.
- Claude API entegrasyonu Sprint 2'de açılacak. API key kullanıcıdan UI'da
  alınıp SQLite'da DPAPI ile şifrelenecek. Bunun için `tauri-plugin-sql`
  eklenmeli.
- Event Log analizi için `windows-rs Win32_System_EventLog` feature flag'i
  Cargo.toml'a eklenmeli.
