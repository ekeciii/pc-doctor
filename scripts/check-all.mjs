#!/usr/bin/env node
/**
 * Faz 3 — composite CI guard. Tüm doğrulama adımlarını sıralı koştur.
 *
 * Adımlar:
 *  1. `node scripts/check-i18n.mjs` — TS dict + t() çağrı uyumu
 *  2. `cargo fmt --check` — Backend format (hızlı fail)
 *  3. `cargo clippy --all-targets -- -D warnings` — Backend lint
 *  4. `prettier --check` — Frontend format
 *  5. `cargo test --test security_invariants` — Backend invariant 1-22
 *  6. `cargo test --lib` — Backend unit tests
 *  7. `npm test` (vitest) — Frontend saf-mantık testleri (toError vb.)
 *  8. `npm run build` — Frontend TS compile + Vite bundle
 *
 * `cargo audit` BİLEREK burada değil — release.yml'nin kendi audit adımı var
 * (bkz. o dosya); check:all'a eklemek her local `npm run check:all` çalıştıran
 * geliştiricinin `cargo-audit` binary'sini kurmasını zorunlu kılardı.
 *
 * Exit 0 hepsi geçtiyse; ilk fail'de stop.
 * Çalıştırma: `npm run check:all`
 * Lokal kurulum: `rustup component add clippy rustfmt` (bir kez).
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_DIR = resolve(ROOT, "src-tauri");

const STEPS = [
  {
    name: "i18n integrity",
    cmd: "node",
    args: ["scripts/check-i18n.mjs"],
    cwd: ROOT,
  },
  {
    name: "Backend rustfmt check",
    cmd: "cargo",
    args: ["fmt", "--check"],
    cwd: TAURI_DIR,
  },
  {
    name: "Backend clippy",
    cmd: "cargo",
    args: ["clippy", "--all-targets", "--message-format=short", "--", "-D", "warnings"],
    cwd: TAURI_DIR,
  },
  {
    name: "Frontend format check (prettier)",
    cmd: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "format:check"],
    cwd: ROOT,
  },
  {
    name: "Backend security_invariants",
    cmd: "cargo",
    args: ["test", "--test", "security_invariants", "--message-format=short"],
    cwd: TAURI_DIR,
  },
  {
    name: "Backend lib tests",
    cmd: "cargo",
    args: ["test", "--lib", "--message-format=short"],
    cwd: TAURI_DIR,
  },
  {
    name: "Frontend unit tests (vitest)",
    cmd: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["test"],
    cwd: ROOT,
  },
  {
    name: "Frontend TS compile + Vite build",
    cmd: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "build"],
    cwd: ROOT,
  },
];

function runStep(step) {
  return new Promise((resolveFn, rejectFn) => {
    console.log(`\n> ${step.name}`);
    const start = Date.now();
    const proc = spawn(step.cmd, step.args, {
      cwd: step.cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    proc.on("error", (e) => rejectFn(new Error(`${step.name} spawn: ${e.message}`)));
    proc.on("exit", (code) => {
      const dur = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`OK ${step.name} (${dur}s)`);
        resolveFn();
      } else {
        rejectFn(new Error(`${step.name} exit ${code}`));
      }
    });
  });
}

async function main() {
  const total = Date.now();
  console.log(`PC Doctor — CI guard (${STEPS.length} steps)`);
  for (const step of STEPS) {
    try {
      await runStep(step);
    } catch (e) {
      console.error(`\nFAIL: ${e.message}`);
      process.exit(1);
    }
  }
  const dur = ((Date.now() - total) / 1000).toFixed(1);
  console.log(`\nALL ${STEPS.length} CHECKS PASSED (${dur}s)`);
}

main();
