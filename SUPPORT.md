# Support

## Getting help

PC Doctor is a solo-maintained side project — there's no dedicated support
team, but questions and bug reports are welcome.

- **Bug reports / questions:** open a
  [GitHub issue](https://github.com/ekeciii/pc-doctor/issues/new/choose).
- **Security vulnerabilities:** do **not** open a public issue — see
  [SECURITY.md](./SECURITY.md).
- **Feature requests:** also via
  [GitHub issues](https://github.com/ekeciii/pc-doctor/issues/new/choose)
  (use the feature request template).

## Before opening an issue

1. Make sure you're on the
   [latest release](https://github.com/ekeciii/pc-doctor/releases/latest) —
   many issues are already fixed.
2. Check [existing issues](https://github.com/ekeciii/pc-doctor/issues) for
   the same problem.

## What to include in a bug report

- PC Doctor version (Settings → About, or the installer filename)
- Windows version (`winver`)
- Whether the app was running elevated (admin) or not — check the header
  badge
- Which of the 13 scan categories or which fix action was involved
- Steps to reproduce, and what you expected vs. what happened
- If relevant: the "Technical detail" text from the error banner (it's
  already stripped of personal info — safe to paste)

## What PC Doctor does **not** collect

There's no telemetry and no crash-reporting service — the maintainer can't
see your scan results or logs unless you paste them into an issue yourself.
See [PRIVACY.md](./PRIVACY.md) for the full data-handling explanation.

## Local logs / data locations

If you need to inspect what's stored locally:
- Settings: `%APPDATA%\com.egeyu.pcdoctor\settings.json`
- Scan history (if enabled): `%APPDATA%\com.egeyu.pcdoctor\history.db`
- Pending chkdsk schedule (if any): `%APPDATA%\com.egeyu.pcdoctor\pending_chkdsk.json`
