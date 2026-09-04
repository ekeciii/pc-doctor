#!/usr/bin/env node
/**
 * Faz 4a — tek komutla sürüm senkronizasyonu.
 *
 * Sürüm 4 dosyada elle tutuluyordu (package.json, src-tauri/Cargo.toml,
 * src-tauri/tauri.conf.json, src-tauri/manifest.xml) ve `check:all`/CI bunun
 * tutarlılığını doğrulamıyordu — bkz. scripts/check-version.mjs (bunu doğrular).
 *
 * Kullanım: node scripts/bump-version.mjs 0.2.0
 *
 * Ne yapar:
 *  1. package.json "version"
 *  2. src-tauri/Cargo.toml [package] version
 *  3. src-tauri/tauri.conf.json "version"
 *  4. src-tauri/manifest.xml <assemblyIdentity name="com.egeyu.pcdoctor" version="X.Y.Z.0">
 *  5. `cargo update -p pc-doctor --precise X.Y.Z` — Cargo.lock'taki paket kendi
 *     versiyonunu hemen yansıtsın (yoksa ilk `cargo test`/`cargo build` sessizce günceller,
 *     ama commit öncesi görmek daha iyi).
 *
 * Not: `tauri.conf.json`'ı `"version": "../package.json"` path formuna geçirmek yerine
 * her dosyaya literal yazmayı seçtik — pinlenmiş @tauri-apps/cli sürümünün bu formu
 * destekleyip desteklemediğine bağımlı olmadan, dört dosyada da her zaman aynı davranış.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_DIR = join(ROOT, "src-tauri");

const PACKAGE_JSON = join(ROOT, "package.json");
const CARGO_TOML = join(TAURI_DIR, "Cargo.toml");
const TAURI_CONF = join(TAURI_DIR, "tauri.conf.json");
const MANIFEST_XML = join(TAURI_DIR, "manifest.xml");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  const version = process.argv[2];
  if (!version) fail("Kullanım: node scripts/bump-version.mjs <X.Y.Z>");
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`Geçersiz sürüm "${version}" — semver X.Y.Z bekleniyor (ön-sürüm/build metadata yok).`);
  }

  const changes = [];

  // 1. package.json
  {
    const raw = await readFile(PACKAGE_JSON, "utf8");
    const pkg = JSON.parse(raw);
    const old = pkg.version;
    pkg.version = version;
    await writeFile(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    changes.push(["package.json", old, version]);
  }

  // 2. src-tauri/Cargo.toml — yalnız [package] bölümündeki bare `version = "..."` satırı.
  // Bağımlılıklar `name = { version = "..." }` veya `name = "..."` şeklinde; hiçbiri satır
  // başında bare `version = ` olarak görünmez, o yüzden bu regex güvenle tek eşleşir.
  {
    const raw = await readFile(CARGO_TOML, "utf8");
    const re = /^version = "([^"]*)"/m;
    const m = re.exec(raw);
    if (!m) fail(`Cargo.toml içinde [package] version satırı bulunamadı: ${CARGO_TOML}`);
    const old = m[1];
    const next = raw.replace(re, `version = "${version}"`);
    await writeFile(CARGO_TOML, next, "utf8");
    changes.push(["src-tauri/Cargo.toml", old, version]);
  }

  // 3. src-tauri/tauri.conf.json — regex replace, NOT JSON.parse+stringify: the file has
  // deliberately compact inline arrays/objects (e.g. `["msi", "nsis"]`) that a stringify
  // round-trip would expand to multi-line, creating pure-noise diffs on every version bump.
  {
    const raw = await readFile(TAURI_CONF, "utf8");
    const re = /"version":\s*"([^"]*)"/;
    const m = re.exec(raw);
    if (!m) fail(`tauri.conf.json içinde "version" alanı bulunamadı: ${TAURI_CONF}`);
    const old = m[1];
    const next = raw.replace(re, `"version": "${version}"`);
    await writeFile(TAURI_CONF, next, "utf8");
    changes.push(["src-tauri/tauri.conf.json", old, version]);
  }

  // 4. src-tauri/manifest.xml — yalnız com.egeyu.pcdoctor assemblyIdentity'sinin version'ı
  // (Common-Controls dependency assemblyIdentity'sinin KENDİ version="6.0.0.0"'ı var —
  // ona dokunma; bu yüzden name= ile version= arasını hedef alıyoruz).
  {
    const raw = await readFile(MANIFEST_XML, "utf8");
    const re = /(name="com\.egeyu\.pcdoctor"[\s\S]{0,40}?version=")([^"]*)(")/;
    const m = re.exec(raw);
    if (!m) fail(`manifest.xml içinde com.egeyu.pcdoctor assemblyIdentity'si bulunamadı: ${MANIFEST_XML}`);
    const old = m[2];
    const next = raw.replace(re, `$1${version}.0$3`);
    await writeFile(MANIFEST_XML, next, "utf8");
    changes.push(["src-tauri/manifest.xml", old, `${version}.0`]);
  }

  // 5. Cargo.lock'taki pc-doctor paket versiyonunu hemen tazele.
  const upd = spawnSync("cargo", ["update", "-p", "pc-doctor", "--precise", version], {
    cwd: TAURI_DIR,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (upd.status !== 0) {
    console.warn(
      "⚠ cargo update -p pc-doctor --precise başarısız oldu (Cargo.lock elle veya bir sonraki `cargo test` ile güncellenecek):"
    );
    console.warn(upd.stderr || upd.stdout);
  } else {
    changes.push(["src-tauri/Cargo.lock", "(pc-doctor paketi)", version]);
  }

  console.log(`Sürüm ${version} olarak senkronize edildi:\n`);
  for (const [file, old, next] of changes) {
    console.log(`  ${file}: ${old} → ${next}`);
  }
  console.log("\nDoğrulamak için: node scripts/check-version.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
