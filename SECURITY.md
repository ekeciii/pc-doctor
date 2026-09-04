# Security Policy

## Supported versions

PC Doctor is a single-maintainer, rolling-release desktop app — there is no
long-term-support branch. Only the **latest published release** is
supported; please update before reporting an issue.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting instead:
[github.com/ekeciii/pc-doctor/security/advisories/new](https://github.com/ekeciii/pc-doctor/security/advisories/new)
(Security tab → "Report a vulnerability"). This opens a private discussion
with the maintainer that isn't visible to the public until a fix ships.

If that's unavailable for some reason, open a regular issue that says only
"I have a security report" with no details, and wait to be contacted.

Please include:
- PC Doctor version and Windows build (`winver`)
- Whether the app was running elevated (admin) or not
- Steps to reproduce
- What you'd expect vs. what happened

### Response expectations

This is a side project maintained by one person — there's no SLA, but
security reports get priority over feature work. Expect an initial
acknowledgement within a few days.

## Scope

PC Doctor runs with administrator privileges for some operations (System
Restore, `sfc`/`DISM`, `chkdsk /f`, firewall/UAC/pagefile changes) and
includes a local AI assistant that talks to a separately-installed Ollama
instance on `127.0.0.1`. Relevant report categories:

- Privilege escalation beyond what the UAC-gated commands already do
- A way to make a "diagnostic" (read-only) code path modify the system
- A way to bypass the `safety::allowlist` / `safety::protected` guards and
  delete/modify a file outside their scope
- A way to make the local file-finder's Recycle-Bin move become a
  permanent delete, or delete a protected path
- Injection into any of the hardcoded `System32` command invocations
  (`chkdsk.exe`, `chkntfs.exe`, `shutdown.exe`) — see the security
  invariants in [CLAUDE.md](./CLAUDE.md#non-negotiable-security-invariants)
- A PII leak into the local scan-history database (it's designed to store
  none — see `diagnostics/util::sanitize_params`)
- Anything affecting the auto-updater's signature verification

Not in scope: the local Ollama integration's own security (that's a
separate, independently-installed project), and reports that require the
attacker to already have admin access to the machine.

## Disclosure

Once a fix is released, a GitHub Security Advisory will be published
crediting the reporter (unless anonymity is requested).
