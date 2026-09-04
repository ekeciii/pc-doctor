# Contributing to PC Doctor

PC Doctor is MIT-licensed and open to contributions, though it's currently
maintained by one person as a side project — response times may vary.

## Before you start

For anything beyond a small fix, please open an issue first to discuss the
approach. This is especially true for anything touching:
- `remediation/` (system-changing actions)
- `safety/` (allowlist, protected paths, restore points)
- The chkdsk lifecycle (`remediation/chkdsk.rs`) — see
  [CLAUDE.md](./CLAUDE.md#chkdsk-lifecycle--the-most-complex-invariant)
  before touching this

## Dev setup

See [README.md](./README.md#ön-koşullar) for prerequisites and
[DEVELOPMENT.md](./DEVELOPMENT.md) for the day-to-day dev loop (dev vs.
elevated testing, common errors).

## Before opening a PR

```powershell
npm run check:all
```

This must pass — it's the same composite gate CI runs: version consistency,
i18n dictionary parity, `cargo fmt --check`, `cargo clippy -- -D warnings`,
`prettier --check`, the security-invariant test suite, Rust unit tests,
`vitest`, and the frontend build. A local one-time setup step:

```powershell
rustup component add clippy rustfmt
```

## Non-negotiable rules

- **Security invariants.** PC Doctor tracks a canonical set of ~30 rules
  about what the app is never allowed to do (no `fsutil dirty set`, no
  `bcdedit`, hardcoded `System32` exe paths, chkdsk `/x` forbidden, etc.).
  See [CLAUDE.md](./CLAUDE.md#non-negotiable-security-invariants) for the
  full list. Ten of them are CI-enforced via
  `cargo test --test security_invariants`; breaking any of them (enforced
  or not) will get a PR rejected.
- **i18n is code-based, not string-based.** New user-facing text goes into
  `src/lib/i18n/tr.ts` (the source of truth) first, then `en.ts`. Backend
  `Finding`s use `Finding::code_only(...)` + `.with_*_code(...)` builders
  referencing `finding.<category>.<id>.<field>` keys in
  `src/lib/i18n/findings.tr.ts`/`findings.en.ts` — never a hardcoded
  Turkish (or English) string on the Rust side. `npm run check:i18n`
  validates this.
- **No new PII in scan history.** Anything written to the local SQLite
  history DB goes through `diagnostics/util::sanitize_params`'s per-category
  allow-list. Extend the allow-list explicitly when adding a new param key
  — don't work around it.
- **Diagnose, don't just detect, when you can.** The project's whole point
  is "safe, one-click fixes," not just reporting problems. If you're adding
  a new diagnostic, think about whether it can also ship a fix
  (`FixTier::Auto`/`Guided`) rather than just an `Advisory` info card.

## Commit style

Conventional-commit-ish prefixes (`feat:`, `fix:`, `chore:`, `docs:`) are
appreciated but not enforced. Explain *why*, not just *what*, in the body
for anything non-trivial — future-you (or future-anyone) will thank you.

## Adding a new diagnostic

See [CLAUDE.md](./CLAUDE.md#adding-a-new-diagnostic) for the step-by-step
pattern (collector → diagnostic → command → i18n keys → category grid →
`sanitize_params` allow-list).

## Updating CHANGELOG.md

Add an entry under `[Unreleased]` for anything user-visible (new feature,
behavior change, bug fix, security-relevant change). Keep it in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) categories
(Added/Changed/Fixed/Security).
