# Third-Party Notices

PC Doctor is licensed under the [MIT License](./LICENSE). It bundles a
number of open-source third-party dependencies (Rust crates via Cargo,
npm packages via the frontend build, and self-hosted web fonts). This file
summarizes their licenses. It was compiled on 2026-09-04 using:

```powershell
# Rust dependency tree (src-tauri/)
cargo install cargo-license --locked
cd src-tauri && cargo license --avoid-build-deps --avoid-dev-deps

# npm dependency tree (repo root)
npx license-checker --production --summary
```

Re-run these commands after any dependency change to keep this file accurate.

## Summary

Every dependency in both trees resolves to a **permissive** license —
**no copyleft license (GPL, AGPL, LGPL) appears anywhere** in the Rust or
npm dependency graphs, direct or transitive. Distribution as part of an
MIT-licensed, closed-or-open binary is unrestricted.

Licenses observed, Rust (`src-tauri/`, release build, excluding build/dev
dependencies):

- MIT
- Apache-2.0
- MIT OR Apache-2.0 (dual-licensed; MIT terms apply here)
- BSD-2-Clause / BSD-3-Clause
- ISC
- Zlib
- 0BSD
- Unlicense (public domain equivalent)
- Unicode-3.0
- CDLA-Permissive-2.0 (`webpki-roots`, `webpki-root-certs`)
- MPL-2.0 (`cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`,
  `selectors` — file-level weak copyleft; only applies if these specific
  files are modified and redistributed, which PC Doctor does not do)

Licenses observed, npm (repo root, production dependencies):

- MIT (7 packages)
- MIT OR Apache-2.0 / Apache-2.0 OR MIT (4 packages, dual-licensed)
- Apache-2.0 (1 package)
- ISC (1 package)
- OFL-1.1 (3 packages — see **Fonts** below)

(`license-checker` additionally reports `pc-doctor@0.1.0` itself — the
project's own `package.json` entry, not a dependency — as `UNLICENSED`; this
is a known `license-checker` quirk with `"private": true` packages and does
not reflect the actual `license` field, which is `MIT`.)

## Fonts (SIL Open Font License 1.1)

PC Doctor self-hosts three type families via `@fontsource` packages
instead of loading them from a CDN, so no font request ever leaves the
user's machine:

- Bricolage Grotesque (`@fontsource-variable/bricolage-grotesque`)
- Geist Mono (`@fontsource/geist-mono`)
- Plus Jakarta Sans (`@fontsource/plus-jakarta-sans`)

All three are distributed under the [SIL Open Font License 1.1](https://scripts.sil.org/OFL),
a permissive license designed specifically for font redistribution and
embedding — bundling, embedding, and redistributing (including with
software under a different license, such as this project's MIT license)
is explicitly allowed. OFL-1.1 does not permit selling the font files on
their own, which does not apply here (they ship only as part of the app).

## Regenerating the full itemized list

This file intentionally summarizes by license family rather than
reprinting the full per-package list (300+ transitive Rust crates alone).
For an exhaustive, per-package attribution file (e.g. for a formal
release artifact), generate one with
[`cargo-about`](https://github.com/EmbarkStudios/cargo-about):

```powershell
cargo install cargo-about
cd src-tauri
cargo about generate about.hbs > full-attribution.html
```
