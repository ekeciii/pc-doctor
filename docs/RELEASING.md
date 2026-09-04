# Release Süreci

## Tek seferlik kurulum

### 1. GitHub repo'su

PC Doctor için public veya private bir GitHub repo'su olmalı. Tauri updater config'inde repo adı `ekeciii/pc-doctor` olarak hardcoded — başka bir kullanıcı/repo kullanacaksan `src-tauri/tauri.conf.json` içindeki `plugins.updater.endpoints` URL'sini ve `landing/index.html` içindeki download linkini güncelle.

### 2. Updater imzalama anahtarı

Bir kez üretildi: `~/.tauri/pc-doctor.key` (private), `pc-doctor.key.pub` (public). Public key zaten `tauri.conf.json`'da gömülü. **Private key'i kaybedersen yeni sürüm yayınlayamazsın** çünkü kurulu instance'lar yeni public key'i tanımıyor. Yedeklemek için:

```powershell
# Şifreli bir USB'ye veya 1Password/Bitwarden'a yedekle
Copy-Item "$env:USERPROFILE\.tauri\pc-doctor.key" D:\backup\pc-doctor.key
```

### 3. GitHub secrets

Repo Settings → Secrets and variables → Actions → New repository secret:

| Secret | Değer | Zorunlu mu? |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/pc-doctor.key` dosyasının **içeriği** (cat ile aç, base64 değil) | Evet — updater için şart |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Üretirken parola koymuşsan; yoksa boş string | Opsiyonel |
| `WINDOWS_CERTIFICATE` | base64-encoded .pfx — code-sign sertifikası alındığında | Opsiyonel ama SmartScreen için gerekli |
| `WINDOWS_CERTIFICATE_PASSWORD` | .pfx parolası | Opsiyonel |

Private key dosyası içeriğini çıkarmak için:

```powershell
Get-Content "$env:USERPROFILE\.tauri\pc-doctor.key" -Raw
```

Tüm dosyayı kopyala (header satırları dahil), GitHub'da secret olarak yapıştır.

## Sürüm yayınlama

### Lokal hazırlık

Sürüm 4 dosyada tutulur: `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `src-tauri/manifest.xml` (+ `src-tauri/Cargo.lock`
kendi paket girdisi). Bunları elle düzenleme — `bump-version.mjs` hepsini tek
seferde senkronize eder, `check-version.mjs` de `check:all`'ın ilk adımı
olarak tutarlılığı zaten doğrular:

```powershell
node scripts/bump-version.mjs 0.1.1
node scripts/check-version.mjs   # ✓ doğrulama (isteğe bağlı — check:all zaten çalıştırır)
git add .
git commit -m "Release v0.1.1"
git push
```

### Tag push (CI otomatik bundle)

```powershell
git tag v0.1.1
git push --tags
```

`.github/workflows/release.yml` otomatik tetiklenir:
1. Windows runner üzerinde npm install + tauri build
2. MSI + NSIS bundle üretilir
3. `TAURI_SIGNING_PRIVATE_KEY` ile updater .sig dosyası üretilir
4. (Sertifika varsa) MSI + NSIS exe kod-imzalanır
5. `latest.json` manifest oluşturulur
6. GitHub Release oluşur, dosyalar yüklenir

CI ~10-25 dakika sürer. Bittiğinde `https://github.com/ekeciii/pc-doctor/releases/tag/v0.1.1` adresinde:
- `PC Doctor_0.1.1_x64_en-US.msi`
- `PC Doctor_0.1.1_x64-setup.exe`
- `latest.json`

`latest.json` Tauri updater tarafından okunur — bir sonraki uygulama açılışında kullanıcı banner görür.

### Manuel test (release etmeden önce)

```powershell
npm run tauri build
```

Çıktı `src-tauri/target/release/bundle/{msi,nsis}/` altında. MSI'yı bir test makinesinde çift tıkla, kurulum çalışıyor mu doğrula.

## Updater nasıl çalışır?

1. Uygulama açılırken `checkForUpdate()` çağrılır (sessiz, ağ hatası UI'da görünmez).
2. `https://github.com/ekeciii/pc-doctor/releases/latest/download/latest.json` indirilir.
3. Manifest'teki `version` mevcut sürümden büyükse banner görünür.
4. Kullanıcı "İndir ve kur" derse:
   - Manifest'teki URL'den NSIS installer indirilir
   - `.sig` dosyası public key ile doğrulanır (manipüle edilmemiş)
   - İndirme bittiğinde installer otomatik çalıştırılır
   - Uygulama kapanır, installer yeni sürümü kurar

## Sorun giderme

### `TAURI_SIGNING_PRIVATE_KEY env not set` CI hatası

Secret yanlış adlandırılmış veya repo Settings'te değil. `TAURI_SIGNING_PRIVATE_KEY` adı tam.

### Kullanıcı banner görmüyor

- Yeni release public mi? Private repo'da updater download hata verir.
- `latest.json` release assets'inde var mı?
- Endpoint URL doğru mu? `https://github.com/<owner>/<repo>/releases/latest/download/latest.json` template'ine uymalı.
- Local cache: `%LOCALAPPDATA%\com.egeyu.pcdoctor\Updater` klasörünü sil.

### NSIS installer "Bilinmeyen yayıncı" diyor

Code-sign sertifikası yok demek. Kullanıcı "Daha fazla bilgi → Yine de çalıştır" der. Sertifika alımı için [CODESIGN.md](./CODESIGN.md).
