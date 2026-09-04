# KVKK Aydınlatma Metni

*Son güncelleme: 2026-09-04*

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") m. 10 uyarınca,
PC Doctor yazılımının kişisel veri işleme faaliyetine ilişkin aydınlatma
aşağıdadır. Genel gizlilik açıklaması için bkz. [PRIVACY.md](../PRIVACY.md)
— bu belge onun KVKK'ya özgü formal karşılığıdır; içerik olarak birbirini
tamamlar, çelişmez.

## 1. Veri Sorumlusunun Kimliği

| Alan | Bilgi |
|---|---|
| Ad soyad | Ege Yücel |
| Sıfat | PC Doctor'ın tek geliştiricisi ve telif hakkı sahibi (bireysel, tüzel kişilik yok) |
| İletişim | [github.com/ekeciii](https://github.com/ekeciii) üzerinden GitHub Issues |

PC Doctor'ın işlettiği bir sunucu, veritabanı, bulut hizmeti veya üçüncü
taraf veri işleyicisi (data processor) **yoktur**.

## 2. Kişisel Verilerin İşlenme Amacı

PC Doctor, çalıştığı Windows bilgisayarın **teknik durumunu** tanılamak ve
(kullanıcı onayıyla) düzeltmek amacıyla sistem bilgisi okur (bkz.
[PRIVACY.md](../PRIVACY.md) tablo). Bu verilerin büyük çoğunluğu doğrudan
**kişisel veri değildir** (disk doluluk oranı, sürücü sürüm bilgisi, firewall
durumu vb. — cihaza ait teknik veri). Kişisel veri sınırına yaklaşan tek
kategori, kullanıcının kendi seçtiği dosyaların **tam dosya yolu/adıdır**
(büyük-dosya bulucu panelinde) — bu da yalnızca ekranda gösterilir, hiçbir
yere kaydedilmez veya iletilmez.

**Önemli:** Bu işlemlerin tamamı, veri PC Doctor'ın kontrolü dışına
çıkmadan, **kullanıcının kendi cihazında** gerçekleşir. Veri sorumlusuna
(Ege Yücel'e) hiçbir tarama verisi ulaşmaz — bu nedenle klasik anlamda bir
"veri sorumlusu → veri işleme" ilişkisi kurulmaz; kullanıcı kendi verisinin
tek muhatabıdır.

## 3. Kişisel Verilerin İşlenmesinin Hukuki Sebebi

KVKK m. 5/2-(f) — "İlgili kişinin temel hak ve özgürlüklerine zarar
vermemek kaydıyla, veri sorumlusunun meşru menfaati için veri işlenmesinin
zorunlu olması" ile birlikte, işlemenin **tamamen kullanıcı cihazında,
kullanıcının doğrudan kontrolünde ve açık talebiyle (TARA butonuna basma)**
gerçekleşmesi, veri aktarımı olmaması nedeniyle KVKK'nın öngördüğü riskli
senaryoların (üçüncü taraf paylaşımı, yurt dışı aktarım, profil çıkarma)
hiçbiri söz konusu değildir.

## 4. Kişisel Verilerin Aktarılması

**Aktarım yoktur.** Ne yurt içine ne yurt dışına, hiçbir üçüncü tarafa veri
aktarılmaz. Tek istisna: uygulama güncelleme kontrolü sırasında GitHub'a
atılan HTTP isteği (bkz. [PRIVACY.md](../PRIVACY.md) "Ağ trafiği" bölümü) —
bu istek tarama verisi içermez, yalnızca "hangi sürüm mevcut?" sorgusudur;
IP adresiniz bu isteğin bir parçası olarak doğal biçimde GitHub'a görünür
(herhangi bir web isteğinde olduğu gibi).

## 5. Kişisel Veri Sahibinin (İlgili Kişinin) Hakları — KVKK m. 11

KVKK m. 11 uyarınca kişisel verisi işlenen kişi olarak haklarınız — bu
yazılım özelinde nasıl kullanıldıkları:

- **Bilgi talep etme:** Bu belge + [PRIVACY.md](../PRIVACY.md) tam kapsamı
  açıklar.
- **İşlenip işlenmediğini öğrenme / erişim:** Tüm veri zaten cihazınızda —
  Ayarlar → Tarama Geçmişi'nden doğrudan görebilirsiniz.
- **Düzeltme / silme:** Tarama geçmişini Ayarlar'dan tek tıkla tamamen
  silebilir, saklama süresini değiştirebilirsiniz. Veri sorumlusuna
  "silme talebi" göndermenize gerek yoktur — kontrol zaten sizde.
- **Zarara uğrama halinde tazminat talep etme:** Kanunun öngördüğü genel
  yollar geçerlidir; iletişim için GitHub Issues kullanılabilir.

## 6. Başvuru Yöntemi

Sorularınız veya talepleriniz için:
[github.com/ekeciii/pc-doctor/issues](https://github.com/ekeciii/pc-doctor/issues)
üzerinden bir issue açabilirsiniz.
