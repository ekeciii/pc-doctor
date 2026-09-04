## What does this change

<!-- One or two sentences: what and why. -->

## Checklist

- [ ] `npm run check:all` passes locally (version consistency, i18n, `cargo fmt`/`clippy -D warnings`, `prettier`, security invariants, Rust unit tests, `vitest`, frontend build)
- [ ] No [security invariant](../CLAUDE.md#non-negotiable-security-invariants) is violated (if this touches `remediation/`, `safety/`, or admin-gated commands)
- [ ] New/changed user-facing text went into `src/lib/i18n/tr.ts` (source of truth) + `en.ts`, or `findings.tr.ts` + `findings.en.ts` for `Finding`s — not a hardcoded string on the Rust side
- [ ] `CHANGELOG.md` updated under `[Unreleased]` (for anything user-visible)
- [ ] If this adds a new diagnostic: collector has no thresholds, `sanitize_params` allow-list extended for any new param keys, category added to the frontend grid

## How was this tested

<!-- Manual repro steps, or which automated tests cover it. -->
