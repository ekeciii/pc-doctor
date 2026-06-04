#!/usr/bin/env node
/**
 * Sprint 15 — i18n template/param mismatch validator.
 *
 * TS exhaustive Record<TKey, string> zaten EN dict'in tüm key'leri kapsadığını garanti eder.
 * Bu script EK olarak şunları check eder:
 *  - Tüm `t("key")` çağrıları TKey'de tanımlı (TS zaten yakalar, defansif)
 *  - `t("key", { p: ... })` çağrılarında template `{p}` placeholder'ı VAR
 *  - Template `{p}` referansı varsa caller'ın params'ında `p` MEVCUT
 *  - findings.tr.ts/findings.en.ts: template'lerdeki `{p}` Backend params'ında karşılık var mı?
 *    (semi-best-effort; tüm Backend emit sitelerini scan etmek bu script kapsamında yok.)
 *
 * Çalıştırma: `node scripts/check-i18n.mjs`
 * Exit code 0 = OK, 1 = mismatch.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** Recursive .ts/.tsx find. */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name) && !p.endsWith(".d.ts")) yield p;
  }
}

/** Extract `t("key", { p: ... })` calls from source. */
function extractTCalls(source) {
  const calls = [];
  // Simple regex — doesn't handle nested braces in 2nd arg perfectly, but works for our patterns.
  const re = /\bt\(\s*"([^"]+)"(?:\s*,\s*(\{[^}]*\}))?\s*\)/g;
  let m;
  while ((m = re.exec(source))) {
    const key = m[1];
    const paramsStr = m[2];
    const params = new Set();
    if (paramsStr) {
      // Extract param names handling both `{volume: x}` (long form) and `{volume}` (shorthand).
      // Strip outer braces, split by comma at top level.
      const inner = paramsStr.replace(/^\{\s*/, "").replace(/\s*\}$/, "");
      const tokens = inner.split(/,/);
      for (const tok of tokens) {
        const t = tok.trim();
        if (!t) continue;
        // Match identifier optionally followed by ":"
        const m = /^(\w+)(?:\s*:|$)/.exec(t);
        if (m) params.add(m[1]);
      }
    }
    calls.push({ key, params });
  }
  return calls;
}

/** Extract template `{placeholder}` references. */
function extractPlaceholders(template) {
  const out = new Set();
  const re = /\{(\w+)\}/g;
  let m;
  while ((m = re.exec(template))) {
    out.add(m[1]);
  }
  return out;
}

async function loadDict(filepath) {
  const raw = await readFile(filepath, "utf8");
  const dict = {};
  // Match BOTH `"key": "value"` and bare `key: "value"` (TS identifier syntax).
  // Two passes (different anchors) — first quoted keys, then bare identifier keys.
  const quoted = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const bare = /(?:^|[\s,{])([a-zA-Z_$][\w$]*)\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  for (const re of [quoted, bare]) {
    let m;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const value = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      dict[key] = value;
    }
  }
  return dict;
}

async function main() {
  const trPath = join(SRC, "lib/i18n/tr.ts");
  const enPath = join(SRC, "lib/i18n/en.ts");
  const findingsTrPath = join(SRC, "lib/i18n/findings.tr.ts");
  const findingsEnPath = join(SRC, "lib/i18n/findings.en.ts");

  const tr = await loadDict(trPath);
  const en = await loadDict(enPath);
  const findingsTr = await loadDict(findingsTrPath);
  const findingsEn = await loadDict(findingsEnPath);

  const errors = [];
  const warnings = [];

  // === Check 1: TR/EN key parity ===
  const trKeys = new Set(Object.keys(tr));
  const enKeys = new Set(Object.keys(en));
  for (const k of trKeys) {
    if (!enKeys.has(k)) errors.push(`[tr/en parity] EN missing key: ${k}`);
  }
  for (const k of enKeys) {
    if (!trKeys.has(k)) errors.push(`[tr/en parity] TR missing key: ${k}`);
  }

  // Same for findings dicts
  const ftKeys = new Set(Object.keys(findingsTr));
  const feKeys = new Set(Object.keys(findingsEn));
  for (const k of ftKeys) {
    if (!feKeys.has(k))
      errors.push(`[findings parity] EN missing finding code: ${k}`);
  }
  for (const k of feKeys) {
    if (!ftKeys.has(k))
      errors.push(`[findings parity] TR missing finding code: ${k}`);
  }

  // === Check 2: Template `{p}` parity TR↔EN ===
  for (const k of trKeys) {
    if (!enKeys.has(k)) continue;
    const trP = extractPlaceholders(tr[k]);
    const enP = extractPlaceholders(en[k]);
    for (const p of trP) {
      if (!enP.has(p))
        warnings.push(`[template parity] EN["${k}"] missing {${p}} (TR has it)`);
    }
    for (const p of enP) {
      if (!trP.has(p))
        warnings.push(`[template parity] TR["${k}"] missing {${p}} (EN has it)`);
    }
  }

  // === Check 3: Scan t("...") calls in code ===
  const tCalls = [];
  for await (const file of walk(SRC)) {
    if (file.endsWith("tr.ts") || file.endsWith("en.ts")) continue;
    if (file.endsWith("findings.tr.ts") || file.endsWith("findings.en.ts")) continue;
    const source = await readFile(file, "utf8");
    const calls = extractTCalls(source);
    for (const c of calls) {
      tCalls.push({ ...c, file: file.slice(ROOT.length + 1) });
    }
  }

  // Validate each t() call
  for (const c of tCalls) {
    if (!trKeys.has(c.key)) {
      errors.push(`[t() call] Unknown key "${c.key}" used in ${c.file}`);
      continue;
    }
    // Template placeholders TR (assume EN same; check above warned).
    const templateP = extractPlaceholders(tr[c.key]);
    for (const p of templateP) {
      if (!c.params.has(p)) {
        warnings.push(
          `[t() call] ${c.file}: t("${c.key}") template has {${p}} but caller params missing`
        );
      }
    }
    for (const p of c.params) {
      if (!templateP.has(p)) {
        warnings.push(
          `[t() call] ${c.file}: t("${c.key}") caller has ${p} but template doesn't use {${p}}`
        );
      }
    }
  }

  console.log(`Scanned ${tCalls.length} t() calls`);
  console.log(`TR dict: ${trKeys.size} keys, EN dict: ${enKeys.size} keys`);
  console.log(`Findings TR: ${ftKeys.size}, Findings EN: ${feKeys.size}`);
  console.log();

  if (warnings.length > 0) {
    console.warn(`⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn("  " + w);
    console.log();
  }
  if (errors.length > 0) {
    console.error(`✗ ${errors.length} error(s):`);
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }
  console.log("✓ i18n integrity OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
