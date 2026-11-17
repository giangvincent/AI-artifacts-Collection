# Portability & Team-Shareability Report

Content-level rescan of every artifact in this repo (not just names): grepped for machine-bound
markers (`/Users/<username>`, `localhost`), verified `SKILL.md` frontmatter on all 145 skill
folders, and inspected every MCP server command, hook, rule, mod, and automation.
Machine-compiled `__pycache__` files were removed from `teach-arch` and `ui-ux-pro-max` during this pass.

Legend: ✅ applies as-is · ⚠️ applies with setup/edits · ❌ bound to this machine or personal-only

---

## Filter 1 — "I start a fresh machine with a new AI agent. What takes effect?"

### ✅ Tier 1 — Drop-in portable (128 skills)

Skills following the `SKILL.md` + YAML frontmatter standard are auto-discovered by all skills-capable
agents (Claude Code, Codex, Gemini CLI, Cursor, Continue, Windsurf, Kiro, Roo, Cline, Trae, Qoder,
Factory, Augment, OpenCode, CodeBuddy, CodeWhale, Merlin — proven by this machine: the same skills
were live in 16 agents' directories simultaneously).

Install on a new machine: copy folder(s) into `~/.agents/skills/` (hub many agents read) or the
per-agent dir (`~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/skills/`, ...). Zero config needed.

This covers the whole `SKILL.md` set **except** the ⚠️/❌ entries below — i.e. the 86-skill `.agents`
hub (tdd, code-review, grilling, spec-driven-development, design pack, ...), the 19 cursor-specific
skills, 14 Merlin skills, and the codex/commandcode/claude-only skills without external deps.

### ⚠️ Tier 2 — Portable, needs a companion tool installed (9 skills)

| Skill | Needs on new machine |
|---|---|
| `rtk` ecosystem users: `caveman`, `caveman-commit`, `caveman-compress`, ... + `RTK.md` instructions | `rtk` binary installed |
| `teach-arch`, `teach-site` | python3 (template servers included) |
| `ui-ux-pro-max` | python3 (scripts included) |
| `diagnosing-bugs` | bash (template script included) |
| `browser-testing-with-devtools` | Chrome + devtools MCP |

### ⚠️ Tier 3 — Portable but agent-locked (works only if you run that agent again)

| Artifact | Agent | Note |
|---|---|---|
| `mods/*.ts` (4) | Command Code only | `@commandcode/harness` API |
| `rules/codex-default.rules` | Codex only | generic e2e allowlist — also a good team template |
| `hooks/codex-hooks.json` | Codex only | ⚠️+ path fix: points at this machine's `~/.local/bin/graphify` |
| `hooks/rtk-hook-gemini.sh` | Gemini only | needs `rtk` binary |

### ⚠️ Tier 4 — Reference-only on a new machine (not drop-in, still useful)

| Artifact | How it applies |
|---|---|
| `mcp/` — `agentmemory`, `playwright` (npx-based) | ✅ actually drop-in: npx fetches on demand |
| `mcp/` — 7 other servers (headroom, laya-control, pencil, private-app, computer-use, node_repl, MCP_DOCKER) | ❌ hard-coded paths to this machine's apps/venvs — use as a *rebuild checklist*, not config |
| `extensions/*-extensions.json` | reinstall list for marketplace extensions |
| `instructions/AGENTS.md` | ⚠️ copy as template, edit out 3 personal paths (laya venv, RTK section is fine if rtk installed) |
| `instructions/CLAUDE.md`, `GEMINI.md`, `RTK.md` | ⚠️ portable text; RTK.md assumes rtk installed |
| `manifests/` | provenance only |
| `plugins/` manifests | Codex re-downloads curated plugins itself; `created-by-me-remote` is your authorship record |

### New-machine adoption recipe (shortest path)

1. `git clone` this repo; `cp -r skills/* ~/.agents/skills/` → most agents pick them up
2. Copy `mcp/agentmemory` + `mcp/playwright` entries into the new agent's MCP config (redacted values already safe)
3. Reinstall editor extensions from `extensions/*.json` if using those editors
4. Rebuild local services (headroom, laya, pencil, private-app) only if you actually used them — configs document what they were
5. Copy `instructions/*.md` after editing the 3 personal paths

---

## Filter 2 — "Which artifacts can the whole dev team apply?"

### ✅ Universal engineering skills — safe for every member, any stack (38)

`tdd`, `test-driven-development`, `code-review`, `code-review-and-quality`, `security-audit`,
`security-and-hardening`, `diagnosing-bugs`, `debugging-and-error-recovery`, `codebase-design`,
`domain-modeling`, `api-and-interface-design`, `documentation-and-adrs`,
`git-workflow-and-versioning`, `resolving-merge-conflicts`, `git-guardrails-claude-code`,
`ci-cd-and-automation`, `performance-optimization`, `planning-and-task-breakdown`,
`spec-driven-development`, `incremental-implementation`, `deprecation-and-migration`,
`code-simplification`, `context-engineering`, `doubt-driven-development`, `karpathy-guidelines`,
`using-agent-skills`, `find-skills`, `grilling`, `pr`, `prototype`, `research`, `wizard`,
`handoff-writer`, `improve-codebase-architecture`, `retro`, `triage`, `to-spec`, `to-tickets`

### ✅ Frontend/product team (11)

`ui-styling`, `ui-ux-pro-max`, `design`, `design-system`, `brand`, `banner-design`, `slides`,
`frontend-design`, `frontend-ui-engineering`, `web-design-guidelines`, `minimalist-ui`, `graphify`

### ⚠️ Stack-conditional — include only if the team uses that stack

`laravel-specialist` (Laravel) · `nodejs-backend-patterns` (Node) · `vercel-react-best-practices`,
`vercel-react-native-skills` (React/Vercel) · `vue-best-practices` (Vue) · `python-appservice-deploy`
(Azure App Service) · `typesafe-ai` (TypeScript AI SDKs) · `setup-pre-commit`, `scaffold-exercises`,
`setup-ts-deep-modules` (TS repos) · BMAD modules `bmad-*` (teams adopting BMAD methodology) ·
`rules/codex-default.rules` (Codex e2e allowlist — good starting template)

### ❌ Personal — do NOT push to the team

- **Voice/style preferences**: `caveman*` (10), `ponytail` — they rewrite the agent's personality; a team-wide default nobody asked for
- **Personal tooling deps**: `laya-*` (your local Laya venv), `paseo*` (your orchestration daemon), `merlin-*` (your Merlin app skills)
- **Account tracking**: `mods/account-usage.ts`, `mods/usage.ts` (your Command Code usage)
- **Machine-pinned config**: `hooks/codex-hooks.json` (your binary path), 7 of 9 MCP servers (your local services)
- **Personal memory**: `instructions/AGENTS.md`, `CLAUDE.md`, `GEMINI.md` (your paths + RTK workflow — share the RTK idea, not the file)

### Team rollout suggestion

Share two things: (1) the universal + stack-conditional skill folders as the team baseline repo,
(2) `mcp/` entries for `agentmemory`/`playwright` + `rules/codex-default.rules` as optional
per-developer setup. Everything else stays personal.

---

*Counts: 145 SKILL.md skills verified with valid frontmatter · 6 `bmad-*` doc modules (need BMAD installer)
· machine-compiled `__pycache__` removed · secret greps clean as of the initial commit.*
