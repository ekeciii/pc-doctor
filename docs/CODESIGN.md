# Kod İmzalama (Code Signing) Rehberi

Windows kullanıcısı imzasız bir MSI/EXE açtığında **SmartScreen** "bilinmeyen yayıncı" uyarısı verir. Bunu kaldırmak için **code-signing certificate** lazım. PC Doctor'ı dağıtıyorsan bu adım kritik.

## Karar: SignPath.io OSS (lansman planı, Faz 4b)

Proje MIT lisansına geçtiğinden (bkz. [LICENSE](../LICENSE)) **SignPath.io OSS**
kesin karar — ücretsiz, en az kurulum, en hızlı SmartScreen kabulü. Aşağıdaki
"SignPath.io" bölümündeki adımları GitHub hesabınla sen yapman gerekiyor
(başvuru + onay); geri kalan diğer seçenekler (DigiCert/Sectigo/Azure) bu
karar geçersiz kalırsa yedek olarak aşağıda referans için duruyor.

**Önemli sıralama notu** (release.yml'e bağlanırken unutma): SignPath, `tauri
build`'in ürettiği MSI/NSIS'i **sonradan** Authenticode ile imzalıyor —
imza byte'ları değiştiriyor. Tauri'nin kendi minisign updater imzası
(`.sig`) ise `tauri build` sırasında **imzasız** haldeki dosya üzerinden
üretiliyor. Bu yüzden SignPath'ten imzalı dosya geri geldikten SONRA
`npx @tauri-apps/cli signer sign` ile `.sig`'i **imzalı** dosya üzerinden
yeniden üretmek şart — aksi halde updater, indirdiği (imzalı) dosyanın
imzasını (imzasız dosya için üretilmiş) `.sig` ile doğrulayamaz ve
güncellemeyi reddeder.

## Seçenekler — karşılaştırma (referans; karar yukarıda)

| Seçenek | Yıllık maliyet | Hızlı SmartScreen kabul | Donanım token | Notlar |
|---|---|---|---|---|
| **DigiCert EV Code Signing** | ~$350-550 | ✅ Anında | ✅ USB token | Klasik premium seçenek |
| **SSL.com EV Code Signing** | ~$300-380 | ✅ Anında | ✅ USB token | DigiCert'ten ucuz |
| **Sectigo OV Code Signing** | ~$70-180 | ⚠️ Reputation lazım (~20-50 indirme) | ❌ Yazılım | Düşük bütçeli, sabırlı |
| **Sectigo EV** | ~$280-380 | ✅ Anında | ✅ Token | Sectigo'nun EV varyantı |
| **Azure Trusted Signing** | ~$10/ay ($120/yıl) | ✅ Anında | ❌ Cloud HSM | Microsoft'un kendi servisi, en yeni seçenek |
| **SignPath.io OSS** | **Ücretsiz** | ✅ Anında | ❌ Cloud | **Açık kaynak proje için ücretsiz**, PC Doctor uygun |

Önerim: **SignPath.io** — açık kaynak repo'larsa için ücretsiz EV imza sağlar, en az kurulum, en hızlı SmartScreen kabul. Proje public GitHub'sa hak kazanırsın.

## SignPath.io (Önerilen — ücretsiz)

1. https://signpath.io → "Get started" → "OSS" sekmesi.
2. GitHub ile login.
3. PC Doctor repo'sunu seç.
4. Project profile oluştur. Test signing değil, **release signing**.
5. Approval policy — manual approval (her release'i sen onaylarsın).
6. CI integration → "GitHub Actions" → connector kurulum talimatı verir.

GitHub Actions workflow değişikliği (SignPath kullanırken):

```yaml
- name: Sign artifacts with SignPath
  uses: signpath/github-action-submit-signing-request@v1
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ secrets.SIGNPATH_ORG_ID }}
    project-slug: pc-doctor
    signing-policy-slug: release-signing
    artifact-configuration-slug: msi-and-nsis
    github-artifact-id: <upload edilen artifact id'si>
    wait-for-completion: true
    output-artifact-directory: signed/
```

`release.yml`'ye eklenmesi gerek: önce `actions/upload-artifact` ile MSI/NSIS upload, sonra SignPath ile sign, sonra signed/ klasörünü release'e yükle.

## DigiCert/SSL.com EV ile manuel imza

1. EV sertifikası satın al (~$300-500).
2. USB token gelir (genelde SafeNet 5110).
3. Token'ı tak, sertifika sürücüsünü kur.
4. **PIN'i hatırla** — kaybedersen sertifika çöp.
5. CI'de imzalamak zor (donanım token cloud runner'a takılı değil).

**Pratikte donanım token + CI** kombinasyonu için iki yol:
- **Self-hosted GitHub Actions runner** — fiziksel makinende çalışır, token takılı.
- **Manual sign step** — CI imzasız bundle üretir, indirip lokal `signtool.exe` ile imzalar, release'e tekrar yüklersin.

Lokal imzalama komutu:

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" `
  sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a `
  "src-tauri\target\release\bundle\nsis\PC Doctor_0.1.1_x64-setup.exe"
```

`/a` ile sistemdeki ilk uygun sertifikayı kullanır. `/n "Subject Name"` ile spesifik sertifika seçilebilir.

## Sectigo OV — bütçe seçeneği

Eğer SignPath uygun değilse (private repo, ticari) ama EV pahalı ise: Sectigo OV ~$70-180.

Sakıncası: SmartScreen reputation kazanana kadar ilk ~20-50 indirme "Run anyway" uyarısı görür. Reputation Microsoft'un takdiri — birkaç hafta sürebilir.

Sertifika .pfx olarak gelir. Şu şekilde CI'ye gömülür:

```powershell
# Local'de base64 encode et
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\pc-doctor.pfx")) | Set-Clipboard
```

Sonuçta çıkan string'i GitHub repo secrets'a `WINDOWS_CERTIFICATE` olarak yapıştır. Şifresi: `WINDOWS_CERTIFICATE_PASSWORD`.

Tauri MSI bundler bu secret'leri otomatik kullanır (tauri.conf.json bundler config'i veya env'den).

## Tauri bundle'a sertifika nasıl bağlanır?

`tauri.conf.json` içinde manuel config:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "FF35E22BC0B776BC4D6B83CC25EC4DB7E08B49AB",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "tsp": false
    }
  }
}
```

Veya env var ile (CI tercih edilen):
- `TAURI_KEY_PASSWORD` — sertifika parolası
- `TAURI_PRIVATE_KEY` — (NOT: bu updater anahtarı, kafa karıştırıcı isim)

Sertifika thumbprint'i bulmak için:

```powershell
Get-ChildItem Cert:\CurrentUser\My | Select-Object Thumbprint, Subject
```

## Karar matrisi

| Senaryo | Öneri |
|---|---|
| Açık kaynak, GitHub public | **SignPath.io OSS** (ücretsiz) |
| Kapalı kaynak, bütçe sınırlı, beklersin | Sectigo OV ($70-180) |
| Kapalı kaynak, anında SmartScreen kabul | DigiCert/SSL.com EV ($300-500) |
| Cloud-first, modern | Azure Trusted Signing ($120/yıl) |
| Hiç imzalamak istemiyorsun | SmartScreen "Run anyway" workflow'una alış — her kullanıcı kaybı |

## Sonraki adım

Şu an PC Doctor imzasız. Sürüm yayınlarken kullanıcılar "bilinmeyen yayıncı"
uyarısı görür ama yine de kurabilir. Faz 4b: SignPath.io OSS başvurusunu
yap (GitHub hesabınla — bu adımı otomasyon yapamaz), onay gelince
`release.yml`'i yukarıdaki sıralamayla güncelle.
