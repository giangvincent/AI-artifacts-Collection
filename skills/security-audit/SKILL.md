---
name: security-audit
description: Run a bounded, read-only security check of the current repository — auto-detects the tech stack (composer/npm/pip/go/cargo, wrapped in ddev exec when DDEV is present), runs dependency audits and validation, syntax checks, credential and dangerous-function scans, reviews newly changed code, and validates JavaScript packages without installing dependencies. Use when the user asks for a security check, security audit, vulnerability scan, or repo audit.
argument-hint: "[exclude <path-or-module>]..."
---

# Bounded Security Audit

Read-only security check of the repository in the current working directory.
Never modify files, never install or update dependencies, never fix anything.

## 0. Exclusions from arguments

Arguments are paths, module names, or directories to EXCLUDE from every step
(e.g. deprecated or disabled modules). Apply them as `grep`/`find` path
exclusions everywhere below. No arguments means scan everything custom.

## 1. Detect tech stack

Check the repo root for markers:

| Marker | Stack |
|---|---|
| `composer.json` | PHP / Composer |
| `package.json` | JS / npm (or yarn — check `packageManager` field) |
| `.ddev/config.yaml` | DDEV present — run containerized commands as `ddev exec <cmd>` |
| `pyproject.toml` / `requirements.txt` | Python / pip |
| `go.mod`, `Cargo.toml`, `*.csproj` | Go, Rust, .NET |

Pick the MAIN language from the manifest that carries the application
(a PHP app with a theme-level package.json is PHP-first).

## 2. Dependency audit and validate

For each detected manager (prefix with `ddev exec` when DDEV is present):

- Composer: `composer audit --locked` and `composer validate --no-check-publish`
- npm: `npm audit --audit-level=high`, only where `package-lock.json` exists;
  yarn projects: `yarn audit --level high`
- pip: `pip-audit` if the tool is installed; skip silently if absent

Report: advisory count, severity, package, affected range, and the version
range that fixes it. `composer validate`/`npm audit` exit codes matter —
a scan-command failure is itself a finding.

## 3. Syntax check (main language only)

- PHP: lint every file under custom code dirs,
  `find <dirs> -name "*.php" -print0 | xargs -0 php -l` — print failures
  only plus the final exit code.
- TypeScript: `tsc --noEmit` only if `tsconfig.json` exists.
- Python: `python -m compileall -q <dirs>` (parses without executing).

NEVER run test suites (PHPUnit, jest, pytest, ...), formatters, or linters
with `--fix`.

## 4. Source scans (custom code only)

Custom code = the paths this repo owns. Drupal: `web/modules/custom`,
`web/themes/custom`, `web/sites`. Typical apps: `src/`, `app/`, `lib/`.
Always exclude `vendor/`, `node_modules/`, and the exclusion list from step 0.

Grep for:

1. Committed credentials/keys:
   - `BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY`
   - literal assignments: `(password|passwd|secret|api_key|apikey|token)\s*(=>|[:=])\s*["'][^"']{8,}["']` (case-insensitive)
2. Dangerous calls: `\b(eval|unserialize|shell_exec|exec)\s*\(`
3. Drupal-specific, report when in user-facing code:
   `User::load(1)` and `accessCheck(false)`

Judge each hit:
- Trusted context (cron, CLI importer, admin list builder) and unchanged
  since last audit → accepted; at most one summary line.
- In user-facing code or newly changed code → finding.

## 5. Changed-code review

Determine "newly changed": working-tree diff first, then the recent
non-merge commits (git log) if no last-audit reference exists. Review ONLY
that code for: authentication, authorization, information disclosure,
injection, and unsafe file handling (uploads, path traversal, deletions).
When the diff touches auth or files, open the full files, not just hunks.

## 6. JavaScript checks

- Discover: `find . -name package.json -not -path "*/node_modules/*"`
  plus sibling lockfiles.
- Do NOT install or update dependencies.
- Run only the package's existing NON-INTERACTIVE validation scripts
  (lint/typecheck). Skip build scripts that write artifacts. NEVER run
  watch, serve, dev, start, or any auto-fix (`--fix`) script.
- Report `npm audit --audit-level=high` / `yarn audit --level high` results.

## 7. Report

Concise and structured:

1. Dependency advisories: package, severity, fixed version, one-line action
2. Syntax failures (or "pass, N files")
3. Scan findings — new/actionable only; accepted patterns one line max
4. Changed-code findings
5. Scan-command failures

If nothing actionable changed since the last audit, say so in one line and
remain quiet otherwise.
