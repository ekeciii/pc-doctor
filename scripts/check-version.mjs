#!/usr/bin/env node
/**
 * Faz 4a — sürüm tutarlılık bekçisi. `check:all`'ın İLK adımı (hızlı fail): 4 dosyadan
 * (+ Cargo.lock'un kendi paket girdisinden) okunan sürümler birbirini tutmuyorsa,
 * daha ağır cargo/vitest/build adımlarına geçmeden hemen durdurur.
 *
 * Kaynak dosyayı elle düzenlemek yerine `node scripts/bump-version.mjs <X.Y.Z>` kullan —
 * o hepsini tek seferde yazar.
 *
 * Çalıştırma: `node scripts/check-version.mjs`
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_DIR = join(ROOT, "src-tauri");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const sources = [];

  const pkg = await readJson(join(ROOT, "package.json"));
  sources.push({ file: "package.json", version: pkg.version });

  const cargoToml = await readFile(join(TAURI_DIR, "Cargo.toml"), "utf8");
  const cargoMatch = /^version = "([^"]*)"/m.exec(cargoToml);
  sources.push({
    file: "src-tauri/Cargo.toml",
    version: cargoMatch ? cargoMatch[1] : null,
  });

  const tauriConf = await readJson(join(TAURI_DIR, "tauri.conf.json"));
  sources.push({ file: "src-tauri/tauri.conf.json", version: tauriConf.version });

  const manifest = await readFile(join(TAURI_DIR, "manifest.xml"), "utf8");
  const manifestMatch = /name="com\.egeyu\.pcdoctor"[\s\S]{0,40}?version="([^"]*)"/.exec(
    manifest
  );
  // manifest.xml assembly version'ı 4 segmentli (X.Y.Z.0); son .0'ı düşürüp karşılaştır.
  const manifestVersion = manifestMatch ? manifestMatch[1].replace(/\.0$/, "") : null;
  sources.push({ file: "src-tauri/manifest.xml", version: manifestVersion });

  const cargoLock = await readFile(join(TAURI_DIR, "Cargo.lock"), "utf8");
  const lockMatch = /name = "pc-doctor"\nversion = "([^"]*)"/.exec(cargoLock);
  sources.push({
    file: "src-tauri/Cargo.lock (pc-doctor paketi)",
    version: lockMatch ? lockMatch[1] : null,
  });

  const missing = sources.filter((s) => !s.version);
  if (missing.length > 0) {
    console.error("✗ Sürüm okunamadı:");
    for (const s of missing) console.error(`  ${s.file}`);
    process.exit(1);
  }

  const versions = new Set(sources.map((s) => s.version));
  console.log("Sürüm kaynakları:");
  for (const s of sources) console.log(`  ${s.file}: ${s.version}`);

  if (versions.size > 1) {
    console.error(
      "\n✗ Sürümler tutarsız. `node scripts/bump-version.mjs <X.Y.Z>` ile hepsini senkronize et."
    );
    process.exit(1);
  }

  console.log(`\n✓ Tüm kaynaklar ${[...versions][0]} sürümünde tutarlı.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
