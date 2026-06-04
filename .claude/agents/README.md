# PC Doctor — Ajan Ofisi

Bu klasör proje-seviyeli Claude Code subagent'larını içerir. Her ajan dar bir alanda uzman; ana orchestrator (Claude) doğru ajana iş havale eder.

## Roster

### Çekirdek geliştirme
| Ajan | Görev |
|---|---|
| `rust-backend-engineer` | src-tauri/** kod yazımı, kolektör/diagnostic/remediation modülleri |
| `react-ui-engineer` | src/** TypeScript/Tailwind/CVA, component composition |
| `tauri-specialist` | Tauri 2 plugin, capability, IPC, manifest, bundler config |
| `windows-systems-expert` | Win32 API, WMI/CIM, registry, SMART, Defender bilgisi |
| `powershell-specialist` | Locale-neutral PS scripts, COM/WMI namespace bilgisi |

### Kalite ve güvenlik
| Ajan | Görev |
|---|---|
| `security-reviewer` | Privilege escalation, allowlist, IPC validation, code-sign |
| `adversarial-reviewer` | Multi-lens code review (correctness/reliability/UX/perf) |
| `performance-engineer` | Scan paralelleştirme, PS timeout, bundle size, memory |
| `accessibility-auditor` | WCAG, focus, contrast, keyboard nav |

### Araştırma ve strateji
| Ajan | Görev |
|---|---|
| `windows-internals-researcher` | Yeni Win32/WMI API'leri, deprecation, Win11 25H2+ özellikleri |
| `competitive-intel` | CCleaner/Glary/BleachBit/Wise Care özellik karşılaştırma |
| `localization-specialist` | TR/EN i18n, locale-specific Windows davranışı |

### Operasyon
| Ajan | Görev |
|---|---|
| `ci-cd-engineer` | GitHub Actions, SignPath.io, release.yml, secret yönetimi |
| `release-manager` | Tag → bundle → verify → landing güncelleme orchestration |
| `docs-writer` | README, PRD, sprint docs, RELEASING, CODESIGN |
| `landing-marketing` | landing/*, copywriting, OG, SEO, hosting |

### Meta
| Ajan | Görev |
|---|---|
| `project-architect` | Cross-module mimari kararlar, sprint planlama |
| `memory-keeper` | memory/ dosyalarını güncel tutar |
| `database-architect` | SQLite + DPAPI (Sprint 5+ telemetri, scan history) |
| `ai-integration-architect` | Provider abstraction (deferred — kullanıcı AI istemedi) |

## Kullanım

Ana Claude'a iş verirken: "Bu Defender bulgusunu daha keskinleştir" → ana Claude otomatik `windows-systems-expert` veya `rust-backend-engineer`'a delegasyon yapar. Açıkça istersen: "windows-systems-expert ajanına şunu sor: ...".

## Hand-off zinciri (tipik bir sprint)

```
project-architect → sprint scope
  ├── windows-internals-researcher → API bilgisi
  ├── rust-backend-engineer → kolektör + diagnostic kod
  ├── react-ui-engineer → UI bağlama
  ├── tauri-specialist → capability/plugin ayarı
  ├── adversarial-reviewer → bulgu toplama
  │   └── security-reviewer + performance-engineer (lens)
  ├── docs-writer → spec + memory
  └── memory-keeper → memory güncel tutma
```
