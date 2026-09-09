# AI Maskotu — Proaktif Kategori Sorular Tasarımı

**Tarih:** 2026-09-09
**Durum:** Onaylandı (brainstorming), implementasyon planı bekliyor.

## Bağlam

PC Doctor'ın yerel AI asistanı (`AiChatDrawer.tsx`, Ollama tabanlı,
`127.0.0.1:11434`) şu an tamamen pasif: sağ üstteki ikona elle tıklanmadan
hiç görünmez, kendiliğinden bir şey söylemez. Kullanıcı isteği: asistan daha
"aktif" hissettirsin — hareketli/animasyonlu bir maskot olarak gelsin, ana
ekranda bir tanı kategorisine her tıklandığında tekrar belirip o kategoriyle
ilgili bağlamsal bir soru sorsun.

## Kapsam

- Maskotun görünümü, ne zaman/nerede belirdiği, sorularının kaynağı, tekrar
  tetiklenme kuralı, tıklanınca ne olduğu.
- **Kapsam dışı:** AiChatDrawer'ın kendi sohbet mantığının değişmesi
  (mevcut Ollama-var/yok akışları, rıza banner'ı aynen korunur); yeni bir
  backend AI komutu (mevcut `ai_chat` aynen kullanılır).

## Tasarım

### 1. Bileşen ve yerleşim (A+B kombinasyonu)

Yeni `src/components/AiMascotBubble.tsx` — mevcut `BrandMark` (teal
yuvarlatılmış kare + EKG çizgisi, `src/components/BrandMark.tsx`) yüz
olarak kullanılır. İki görünüm noktası:

- **A — Ana ızgara (`CategoryGrid.tsx`)**: bir kategori kartına tıklanınca
  (`onSelect(cat)` çağrılırken) ekranın sağ-alt köşesinde maskot + konuşma
  balonu 2-3 saniyeliğine "canlanır" (bounce-in ile girer), sonra fade-out
  ile kaybolur. Kategori detayına geçiş (`setSelectedCat`) bundan bağımsız,
  her zamanki gibi anında olur — maskot geçişi bloklamaz, üstüne biner.
- **B — Kategori detay paneli (`CategoryDetail.tsx`)**: panel açıldığında en
  üstte gömülü bir "karşılama şeridi" olarak aynı soruyu gösterir. Panel
  açık kaldığı sürece durur (yüzmez, sayfa akışının parçası, mevcut
  `.microcopy`/kart tarzıyla tutarlı bir kutu).

Her iki görünüm de aynı `AiMascotBubble` bileşenini farklı `variant` prop'uyla
("floating" | "inline") render eder — tekil kaynak, iki sunum.

### 2. Soru kaynağı

- **SSoT sözlük**: `src/lib/i18n/mascotPrompts.tr.ts` + `.en.ts` —
  `findings.tr.ts` ile aynı desen: `Record<"mascot.<categoryKey>.prompt", string>`
  anahtarları, 13 kategori key'i için (`disk-full`, `disk-health`, `chkdsk`,
  `events`, `drivers`, `virus`, `thermal`, `security`, `updates`, `startup`,
  `crashes`, `pagefile`, `cleanup` — bkz. `categoryDefs.tsx`). Her kategori
  için en az 1 sabit soru — Ollama kurulu olmasa/çalışmasa da **anında**
  görünür.
- **Ollama zenginleştirmesi (opsiyonel katman)**: Ollama çalışıyorsa, sabit
  soru arka planda mevcut `ai_chat` komutuna (aynı endpoint, yeni komut
  YOK) o kategorinin gerçek bulgu verisiyle (drive adı, doluluk %'si, hata
  sayısı vb. — `params` alanından, PII whitelist'e uygun) gönderilip daha
  spesifik bir soruya dönüştürülür. Zenginleştirme gelene kadar sabit soru
  zaten ekranda — kullanıcı asla boş/loading bir maskot görmez.

### 3. Tekrar tetiklenme kuralı

- Bir kategori için maskot, o kategorinin bulgu **imzası** (finding id'lerinin
  sıralı listesinin hash'i veya birleşimi) değişmediği sürece **bir kez**
  kendiliğinden belirir. Sonraki tıklamalarda sessiz kalır (kategori detayı
  yine açılır, sadece maskot/banner görünmez).
- İmza `AppSettings`'e eklenen `mascotSeenSignatures: Record<string, string>`
  (kategori key → son görülen imza) alanında persist edilir — hem
  `src-tauri/src/settings.rs`'e `#[serde(default)]` bir alan, hem
  `src/lib/settings.ts`'e karşılığı. Uygulama yeniden açılsa da hatırlanır.
  Yeni bir tarama o kategoride farklı bulgu getirirse (imza değişir) maskot
  tekrar konuşur.

### 4. Tıklama davranışı

Maskota veya konuşma balonuna tıklanınca `AiChatDrawer` açılır
(`AiMascotBubble`'ın `onOpenChat: (category: string, prompt: string) => void`
prop'u App.tsx'teki mevcut drawer-açma state'ini tetikler). `AiChatDrawer`
yeni bir opsiyonel prop alır: `initialContext?: { category: string; prompt: string }`
— verilirse, o soru sohbetin **ilk asistan mesajı** gibi (kullanıcı adına
gönderilmiş gibi DEĞİL, karşılama/açılış mesajı olarak) gösterilir. Mevcut
Ollama-yok/var dalları, AI-rıza banner'ı (`showAiConsent`) aynen çalışmaya
devam eder — `initialContext` sadece rıza + bağlantı kontrolünden SONRA
gösterilecek ilk mesajı belirler, akışı atlamaz.

### 5. Animasyon

Yeni bağımlılık yok — mevcut Tailwind/CSS animasyon sözlüğü kullanılır
(`animate-fade-in`, `animate-pulse-glow` zaten `ScoreHero.tsx`'te var).
Giriş: hafif bir yukarı-sıçrama (`bounce-in`, yeni bir keyframe — mevcut
`index.css`'teki animasyon bloğuna eklenir). Dururken: yavaş `pulse-glow`.
Konuşma balonu metni karakter-karakter beliren bir typewriter efekti alır
(CSS-only, `steps()` animasyonu — JS interval gerekmez).

### 6. Test

- Yeni bir `check-i18n.mjs` benzeri kapsama kontrolü (ya da mevcut script'e
  küçük bir ek): her `categoryDefs.tsx` key'inin `mascotPrompts.tr.ts`'de
  karşılığı var mı (13/13).
- `AiMascotBubble` için vitest: aynı imzayla ikinci tıklamada render
  etmediğini, imza değişince tekrar ettiğini doğrulayan birim testi.
- Mevcut `AiChatDrawer` testleri (varsa) `initialContext` prop'u
  verilmeden de eskisi gibi çalıştığını doğrulamalı (geriye dönük uyumluluk).

## Riskler / açık noktalar

- **İmza hesaplama maliyeti**: 13 kategori × her tarama sonrası imza
  hesaplama — bulgu sayısı küçük (tipik <50), performans sorunu beklenmiyor.
- **Ollama zenginleştirmesi gecikirse** ve kullanıcı bu sırada maskotu
  kapatırsa: zenginleştirilmiş soru sessizce atılır, bir sonraki açılışta
  sabit soru yine gösterilir (state karmaşıklığı istenmiyor).
- **13 kategorinin tümü için anlamlı bir "soru" yazmak** editoryal bir iş —
  bazı kategoriler (örn. "Temizlik") bulgu yokken hiç tetiklenmeyecek zaten
  (yalnız `warning`/`critical` durumdaki kategoriler için maskot düşünülüyor,
  `categoryStat` zaten bu ayrımı yapıyor — `ok`/`idle` durumda maskot hiç
  belirmez).

## Kritik dosyalar

- `src/components/AiMascotBubble.tsx` (yeni)
- `src/lib/i18n/mascotPrompts.tr.ts` + `.en.ts` (yeni)
- `src/components/CategoryGrid.tsx`, `src/components/CategoryDetail.tsx`
  (entegrasyon noktaları)
- `src/components/AiChatDrawer.tsx` (`initialContext` prop)
- `src-tauri/src/settings.rs`, `src/lib/settings.ts` (`mascotSeenSignatures`)
- `src/index.css` (yeni `bounce-in` keyframe)
