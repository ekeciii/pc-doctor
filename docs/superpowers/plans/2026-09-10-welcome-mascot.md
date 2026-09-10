# Karşılama Maskotu (Ana Sayfa Tanıtımı) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI maskotu ana sayfada da (henüz tarama yapılmamışken) belirip kendini ve PC Doctor'ı tanıtsın; her açılışta standby ekranında çıksın, TARA'ya basılınca kaybolsun, tıklanınca sohbet çekmecesini tanıtım metniyle açsın.

**Architecture:** Yeni bileşen/prop yok. Mevcut `AiMascotBubble` floating variant + `mascotPrompt` state'i (`categoryKey: "__welcome__"` sentinel'iyle) + `handleMascotOpenChat` chat-devri aynen kullanılır. Sadece: yeni bir i18n metni (`mascotWelcome`) ve `App.tsx`'te mevcut temizleme effect'inde 1 satır güncelleme + karşılamayı yöneten yeni bir küçük `useEffect`.

**Tech Stack:** React 18 + TypeScript. Test: Vitest `environment: "node"` (proje `.tsx` bileşen testi altyapısına sahip değil — `App.tsx` mantığı elle + `check:all` ile doğrulanır; yeni i18n anahtarının kapsaması `scripts/check-i18n.mjs` ile otomatik doğrulanır).

**Spec:** `docs/superpowers/specs/2026-09-10-welcome-mascot-design.md`

---

## Task 1: `mascotWelcome` i18n anahtarı (TR + EN)

**Files:**
- Modify: `src/lib/i18n/tr.ts` (son satırlar — `cleanedNothing` girdisinden hemen sonra, `} as const;`'den önce)
- Modify: `src/lib/i18n/en.ts` (son satırlar — `cleanedNothing` girdisinden hemen sonra, kapanış `};`'den önce)

- [ ] **Step 1: TR anahtarını ekle**

`src/lib/i18n/tr.ts` içinde şu satırı bul:
```typescript
  cleanedNothing: "Silinecek bir şey bulunamadı",
} as const;
```
Şununla değiştir:
```typescript
  cleanedNothing: "Silinecek bir şey bulunamadı",
  // Karşılama maskotu (ana sayfa tanıtımı)
  mascotWelcome:
    "Merhaba! PC Doctor asistanıyım. Bu uygulama Windows'unun 13 kategoride sağlığını kontrol edip güvenle düzeltir — dosya silmeden. Başlamak için TARA'ya bas, ya da bana bir şey sor.",
} as const;
```

- [ ] **Step 2: EN anahtarını ekle**

`src/lib/i18n/en.ts` içinde şu satırı bul:
```typescript
  cleanedNothing: "Nothing to remove",
};
```
Şununla değiştir:
```typescript
  cleanedNothing: "Nothing to remove",
  // Welcome mascot (home-screen intro)
  mascotWelcome:
    "Hi! I'm the PC Doctor assistant. This app checks your Windows health across 13 categories and fixes issues safely — without deleting files. Press SCAN to start, or ask me anything.",
};
```

- [ ] **Step 3: Prettier + tip kontrolü**

Run: `cd D:/pc-doctor && npx prettier --check src/lib/i18n/tr.ts src/lib/i18n/en.ts && npx tsc -b --noEmit`
Expected: prettier "All matched files use Prettier code style!" ve tsc çıktısız (temiz). `en.ts` `Record<TKey, string>` olduğundan, EN'de `mascotWelcome` eksik olsa derleme hatası verirdi — temiz geçmesi iki tarafın da eklendiğini doğrular.

- [ ] **Step 4: i18n bütünlük kontrolü**

Run: `cd D:/pc-doctor && node scripts/check-i18n.mjs`
Expected: `✓ i18n integrity OK` (TR/EN key paritesi dahil).

- [ ] **Step 5: Commit**

```bash
cd D:/pc-doctor
git add src/lib/i18n/tr.ts src/lib/i18n/en.ts
git commit -m "feat(mascot): add mascotWelcome i18n string (TR/EN)"
```

---

## Task 2: `App.tsx` — karşılama tetikleme + mevcut temizleme effect'ini koru

**Files:**
- Modify: `src/App.tsx` (satır ~143-153 civarındaki mascot state + mevcut temizleme `useEffect`)

- [ ] **Step 1: Mevcut temizleme effect'ini karşılamayı koruyacak şekilde güncelle**

`src/App.tsx` içinde şu bloğu bul (satır ~148-153):
```typescript
  useEffect(() => {
    if (!selectedCat) setMascotPrompt(null);
  }, [selectedCat]);
```
Şununla değiştir:
```typescript
  useEffect(() => {
    if (!selectedCat) {
      // Karşılama maskotu (`__welcome__`) `selectedCat` null iken yaşar —
      // yalnız kategori maskotunu temizle.
      setMascotPrompt((p) => (p?.categoryKey === "__welcome__" ? p : null));
    }
  }, [selectedCat]);
```

- [ ] **Step 2: Karşılamayı yöneten yeni effect'i ekle**

Bir önceki adımda düzenlenen `useEffect` bloğunun HEMEN ALTINA (yani
`}, [selectedCat]);` satırından sonra, `pendingFixSpecs` state tanımından
önce) şunu ekle:
```typescript
  // Karşılama maskotu: standby ekranında (tarama yok + sonuç yok + ilk-açılış
  // modalı kapalı + ayarlar yüklenmiş) kendini ve uygulamayı tanıtır. Kalıcı
  // kaydedilmez — her açılışta yeniden çıkar, TARA'ya basılınca kaybolur.
  useEffect(() => {
    const standby =
      report === null && !scanning && !disclosureOpen && settingsSnapshot !== null;
    if (standby) {
      setMascotPrompt((p) => p ?? { categoryKey: "__welcome__", text: t("mascotWelcome") });
    } else {
      // Tarama başladı/bitti ya da modal açıldı → karşılamayı düşür (kategori
      // maskotuna dokunma).
      setMascotPrompt((p) => (p?.categoryKey === "__welcome__" ? null : p));
    }
  }, [report, scanning, disclosureOpen, settingsSnapshot, t]);
```

**Not (uygulayan için doğrulama):** `t`, `src/lib/i18n/context.tsx:66`'da
`useCallback` ile memoize edilmiş — locale değişmedikçe referansı sabit, bu
yüzden dependency array'de olması effect'i sürekli tetiklemez ve
exhaustive-deps açısından da doğru. `report`, `scanning`, `disclosureOpen`,
`settingsSnapshot` hepsi bu bileşende zaten tanımlı state (`report` satır ~66,
`scanning` ~71, `settingsSnapshot` ~134, `disclosureOpen` ~139). Yeni bir
import gerekmez (`useEffect` zaten import edili).

- [ ] **Step 3: Tip kontrolü**

Run: `cd D:/pc-doctor && npx tsc -b --noEmit`
Expected: çıktısız (temiz).

- [ ] **Step 4: Tam kalite kapısı**

Run: `cd D:/pc-doctor && npm run check:all`
Expected: `ALL 9 CHECKS PASSED` (version + i18n + fmt + clippy + prettier + security invariants + backend lib tests + vitest + frontend build).

- [ ] **Step 5: Elle doğrulama (mümkünse)**

Run: `cd D:/pc-doctor && npm run tauri dev`

**Not:** Uygulama `requireAdministrator` manifesti ile geliyor — açılışta UAC
prompt'u çıkar; otomasyon ortamında bu tıklanamayabilir. Mümkünse şunları
kontrol et, değilse ne denediğini/neyi göremediğini dürüstçe raporla (bu adımı
sessizce atlama):

1. Uygulama açıldığında (TARA'ya basmadan), sağ-alt köşede karşılama maskotu
   bounce-in ile beliriyor, tanıtım metnini gösteriyor, ~6 sn sonra soluklaşıyor.
2. Maskota/balona tıkla → sohbet çekmecesi açılıyor, tanıtım metni asistanın
   ilk mesajı olarak görünüyor.
3. TARA'ya bas → tarama başlayınca/bitince karşılama maskotu artık görünmüyor.
4. (İlk-ever açılışta, temiz profil) `FirstRunDisclosure` modalı açıkken
   karşılama maskotu ÇIKMIYOR; "Anladım, devam et" deyince beliriyor.
5. Bir kategoriye tıkla → o kategorinin maskotu normal çıkıyor (karşılama
   mantığı kategori maskotunu bozmuyor). Geri çık → standby'a dönünce
   karşılama tekrar belirebilir (yeni effect `report === null` iken yeniden
   set eder — bu kabul edilebilir).

- [ ] **Step 6: Commit**

```bash
cd D:/pc-doctor
git add src/App.tsx
git commit -m "feat(mascot): welcome mascot on the home/standby screen"
```

---

## Self-Review (bu plan için yapıldı)

1. **Spec kapsaması:**
   - §1 Metin → Task 1 (tr.ts + en.ts `mascotWelcome`).
   - §2a mevcut temizleme effect'ini koru → Task 2 Step 1.
   - §2b karşılamayı yöneten yeni effect → Task 2 Step 2.
   - §3 render/tıklama değişiklik yok → doğru, hiçbir task `AiMascotBubble`/`AiChatDrawer`/`CategoryDetail`'a dokunmuyor.
   - Test bölümü → Task 1 Step 4 (check-i18n), Task 2 Step 4-5 (check:all + elle).
   - Riskler (FirstRunDisclosure sırası, 6sn fade) → Task 2 Step 5'te elle doğrulama maddeleri.
2. **Placeholder taraması:** yok — her adımda tam kod / tam komut var.
3. **Tip tutarlılığı:** `mascotPrompt` state tipi `{ categoryKey: string; text: string } | null` (mevcut, değişmiyor); `"__welcome__"` sentinel'i her iki task'ta da aynen; `t("mascotWelcome")` anahtarı Task 1'de tanımlanıp Task 2'de kullanılıyor — tutarlı.
