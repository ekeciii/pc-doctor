// Kategori → maskotun kendiliğinden soracağı sabit soru. Ollama kurulu
// olmasa da anında görünür (bkz. docs/superpowers/specs/2026-09-09-ai-mascot-design.md).
export const mascotPromptsTr = {
  "disk-full": "Diskin dolmaya başlamış — hangi klasörler yer kaplıyor, birlikte bakalım mı?",
  "disk-health": "Disklerinden birinde sağlık uyarısı var — ne anlama geldiğini anlatayım mı?",
  chkdsk: "Son 30 günde disk/NTFS hatası kaydedilmiş. chkdsk taramasının ne yapacağını merak ediyor musun?",
  events: "Olay günlüğünde tekrar eden bir hata var — bunun sistemine etkisini konuşalım mı?",
  drivers: "Bazı sürücülerin imzasız veya eski — hangilerinin öncelikli olduğunu birlikte bulalım mı?",
  virus: "Virüs/Defender tarafında dikkat gereken bir şey var — ne yapman gerektiğini anlatayım mı?",
  thermal: "Sistemin ısınıyor veya performans düşüyor gibi — nedenini birlikte araştıralım mı?",
  security: "Güvenlik ayarlarında (güvenlik duvarı/UAC gibi) bir boşluk var — neden önemli, anlatayım mı?",
  updates: "Bekleyen güncellemelerin var — hangilerinin öncelikli olduğunu konuşalım mı?",
  startup: "Açılışın yavaşlamış olabilir — hangi programların yavaşlattığını birlikte bulalım mı?",
  crashes: "Son zamanlarda tekrar eden bir çökme/donma var — sebebini merak ediyor musun?",
  pagefile: "Sanal bellek ayarın gözden geçirilebilir — neden önerdiğimi anlatayım mı?",
  cleanup: "Temizlenebilecek epey yer var — nereden başlamak istersin?",
} as const;

export type MascotCategoryKey = keyof typeof mascotPromptsTr;
