# Karşılama Maskotu (Ana Sayfa Tanıtımı) Tasarımı

**Tarih:** 2026-09-10
**Durum:** Onaylandı (brainstorming), implementasyon planı bekliyor.
**İlgili:** `docs/superpowers/specs/2026-09-09-ai-mascot-design.md` (bu, onun üzerine küçük bir artım)

## Bağlam

AI maskot özelliği (PR #41, `main`'de) şu an yalnızca bir tanı kategorisine
tıklanınca beliriyor. Kullanıcı, maskotun **ana sayfada da** (henüz tarama
yapılmamışken) belirip kendini ve PC Doctor uygulamasını tanıtmasını istiyor —
bir karşılama.

## Kararlar (brainstorming'de netleşen)

- **Sıklık:** Her uygulama açılışında, standby ekranındayken (`report === null
  && !scanning`). Kalıcı kaydedilmez — TARA'ya basılınca kaybolur, sonraki
  açılışta yine çıkar.
- **İlk açılış modalıyla ilişki:** Faz 2'deki `FirstRunDisclosure` (yasal
  veri-bildirim modalı) açıkken karşılama maskotu belirmez; modal onaylanınca
  (`!disclosureOpen`) çıkar.
- **Görsel:** Mevcut `AiMascotBubble` bileşeninin `variant="floating"` hali
  aynen — bounce-in ile girer, ~6 sn sonra soluklaşır (kategori maskotuyla
  tutarlı). Yeni bileşen/prop yok.
- **Tıklama:** Mevcut `handleMascotOpenChat` aynen — sohbet çekmecesi açılır,
  karşılama metni asistanın ilk mesajı gibi görünür (Ollama kuruluysa devam
  edilebilir).

## Tasarım

### 1. Metin

`src/lib/i18n/tr.ts` + `src/lib/i18n/en.ts`'e yeni bir `mascotWelcome`
anahtarı. (Kategori sözlüğü `mascotPrompts.*.ts` katı olarak 13 kategori
key'ine tiplenmiş — oraya değil, genel UI metin sözlüğüne.) İçerik: 1-2
cümlelik tanıtım, örn:

- TR: `"Merhaba! PC Doctor asistanıyım. Bu uygulama Windows'unun 13 kategoride sağlığını kontrol edip güvenle düzeltir — dosya silmeden. Başlamak için TARA'ya bas, ya da bana bir şey sor."`
- EN: `"Hi! I'm the PC Doctor assistant. This app checks your Windows health across 13 categories and fixes issues safely — without deleting files. Press SCAN to start, or ask me anything."`

`tr.ts` `as const` → `TKey` türetir; `en.ts` `Record<TKey, string>` olduğundan
EN'de eksik key derleme hatası verir (mevcut desen).

### 2. State / tetikleme (`App.tsx`)

Mevcut `mascotPrompt` state'i (`{ categoryKey: string; text: string } | null`)
`categoryKey: "__welcome__"` sentinel'iyle yeniden kullanılır. İki değişiklik:

**a. Mevcut temizleme effect'ini karşılamayı koruyacak şekilde güncelle:**

Mevcut:
```typescript
useEffect(() => {
  if (!selectedCat) setMascotPrompt(null);
}, [selectedCat]);
```
Yeni:
```typescript
useEffect(() => {
  if (!selectedCat) {
    setMascotPrompt((p) => (p?.categoryKey === "__welcome__" ? p : null));
  }
}, [selectedCat]);
```
(Kategori maskotu `selectedCat` null olunca yine temizlenir; karşılama —
ki zaten `selectedCat` null iken yaşar — hayatta kalır.)

**b. Karşılamayı yöneten yeni effect:**

```typescript
// Karşılama maskotu: standby ekranında (tarama yok, ilk-açılış modalı kapalı,
// ayarlar yüklenmiş) kendini ve uygulamayı tanıtır. Kalıcı kaydedilmez.
useEffect(() => {
  const standby = report === null && !scanning && !disclosureOpen && settingsSnapshot !== null;
  if (standby) {
    setMascotPrompt((p) => p ?? { categoryKey: "__welcome__", text: t("mascotWelcome") });
  } else {
    // Tarama başladı/bitti veya modal açıldı → karşılamayı düşür (kategori
    // maskotuna dokunma).
    setMascotPrompt((p) => (p?.categoryKey === "__welcome__" ? null : p));
  }
}, [report, scanning, disclosureOpen, settingsSnapshot, t]);
```

`selectedCat` null iken `mascotPrompt` yalnızca `"__welcome__"` veya `null`
olabilir (kategori prompt'u ancak `handleCategorySelect` içinde, `selectedCat`
non-null yapılarak set edilir) — bu yüzden `p ?? ...` güvenli, çakışma yok.

### 3. Render / tıklama — DEĞİŞİKLİK YOK

- Floating bubble render'ı (`{mascotPrompt && <AiMascotBubble key={...} text={mascotPrompt.text} variant="floating" onOpenChat={handleMascotOpenChat} />}`) zaten `mascotPrompt`'a bağlı. `key` `"__welcome__:<text>"` olur, bubble bir kez mount olur, bounce-in + 6 sn sonra fade.
- `handleMascotOpenChat` zaten `if (mascotPrompt) setPendingMascotMessage(mascotPrompt.text)` yapıyor → karşılama metni sohbete asistan mesajı olarak gider.
- `AiChatDrawer`'ın ref-tabanlı tekilleştirmesi karşılama metnini de tam bir kez ekler.
- `CategoryDetail` inline banner: `selectedCat && mascotPrompt?.categoryKey === selectedCat.key` koşuluyla render ediliyor — `"__welcome__"` hiçbir `selectedCat.key`'e eşit olmayacağı için ana sayfa karşılaması detay panelinde ASLA görünmez (doğru davranış).

## Değişen dosyalar

- `src/lib/i18n/tr.ts` + `src/lib/i18n/en.ts` — `mascotWelcome` anahtarı.
- `src/App.tsx` — mevcut temizleme effect'inde 1 satır + ~10 satırlık yeni effect.

Değişmeyen: `AiMascotBubble.tsx`, `AiChatDrawer.tsx`, `CategoryDetail.tsx`,
`settings.rs`/`settings.ts`, `mascotPrompts.*.ts`, `mascotSignature.ts`,
`index.css`.

## Test

- `check-i18n.mjs` zaten `t("mascotWelcome")` çağrısının `tr.ts`/`en.ts`'de
  karşılığı olduğunu doğrular (mevcut kapsama kontrolü) — ek test gerekmez.
- Elle: aç → karşılama köşede beliriyor mu, ~6sn'de soluyor mu; tıkla → sohbet
  açılıp tanıtım metnini gösteriyor mu; TARA → kayboluyor mu; ilk açılışta
  `FirstRunDisclosure` açıkken çıkmıyor, kapanınca çıkıyor mu.

## Riskler / açık noktalar

- İlk-ever açılışta `FirstRunDisclosure` + karşılama sırası: modal `disclosureOpen`
  true iken effect karşılamayı set etmez; kullanıcı "Anladım" deyince
  `disclosureOpen` false olur, effect yeniden çalışır, karşılama belirir. Test
  edilmeli.
- 6 sn fade sonrası karşılama geri gelmez (kullanıcı kaçırırsa sonraki açılışa
  kadar yok) — bilinçli, "bir kez selamla" niyetiyle tutarlı; kalıcı bir köşe
  öğesi istenmedi.
