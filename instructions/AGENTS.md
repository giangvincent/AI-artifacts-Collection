@~/.codex/RTK.md


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->

<!-- laya-control:instructions -->

# Laya Control — Local Routing and Retrieval

`laya-control` provides local MCP tools backed by Laya and Nomic Embed.

These tools are optional assistants. Codex remains responsible for inspecting
source files, making implementation decisions, and running tests.

## Tool selection

Use Codex directly when:

- the task is simple;
- the exact file is already known;
- sufficient context is already available.

Use Nomic when:

- relevant files are unknown;
- the task may span several modules;
- semantic retrieval can avoid opening many unrelated files.

Use Laya when:

- the correct workflow is ambiguous;
- implementation risk needs classification;
- the task may be destructive or require user confirmation.

Do not call Laya or Nomic for greetings, simple questions, obvious one-file
changes, or tasks where their output would not affect the workflow.

## Service status

Before the first Laya or Nomic call in a task, call `local_ai_status` if model
availability is unknown.

If a required model is disabled, report that fact. Do not repeatedly retry it.

## Repository retrieval

For a non-trivial coding task with unknown relevant files:

1. Use `project_add` if the current repository has not been registered.
2. Use `project_index` when the project is new or its index is stale.
3. Use `route_coding_task` with the task and project ID.
4. Treat retrieved files as candidates, not authoritative context.
5. Open the actual files before editing them.

Do not index the repository again during every task unless files have materially
changed.

Use `nomic_retrieve` only when an explicit collection of documents or excerpts
is already available.

## Laya question schema

Always pass `model: "typed-decisions"` for typed workflow questions.

A choice question must contain a non-empty `criteria` object:

```json
{
  "workflow": {
    "type": "choice",
    "instructions": "Choose the appropriate coding workflow",
    "criteria": {
      "implement": "Implement a clear requested change",
      "diagnose": "Investigate existing broken behavior",
      "design": "Decide architecture or interfaces",
      "explain": "Explain without modifying code",
      "ask_user": "A material requirement is missing"
    }
  }
}
```

## Spec-driven development with local AI

When the `spec-driven-development` skill is used for a non-trivial coding task:

1. After understanding the requested outcome and before broad repository
   exploration, call `local_ai_status`.
2. If Nomic is loaded and the relevant files are unknown, use
   `route_coding_task` for repository retrieval.
3. If workflow, risk, or destructiveness is ambiguous, call `laya_decide`.
4. Continue with the spec-driven-development workflow using the retrieved
   context and advisory decision.
5. Open all relevant source files before editing them.
6. Never skip tests or safety checks based on Laya output.

These MCP calls are part of the spec-driven-development workflow; they do not
replace specification, implementation, or verification steps.

If laya-control is unavailable, report it once and continue without it.

<!-- lms-project-analytics:start -->
## Project analytics first (LM Studio)

For any task that touches files, classes, nodes, entries, or any symbol
under a registered repository, **read the analytics before any
other action**. The whole picture of the project lives in two artifacts:

- `docs/analytics/PROJECT_ANALYTICS.md` — the rendered map of every file
  and class: purpose, subsystems, flows, entry points, risks, edges,
  coverage gaps, provenance.
- `docs/analytics/project-map.json` — the machine-readable node/edge
  graph and reference integrity metadata.

Treat both as the initial map of the codebase. Open current source for
verification, but never re-derive the whole picture from scratch when the
analytics exist. When the map is missing or stale (the index timestamp
or file hashes predate the change you are about to make), continue the task
with notification to the user that the analytics are stale and should be regenerated.

This rule applies whenever the task description mentions **files,
classes, nodes, entries, subsystems, flows, entry points, edges, or
risks** — including read-only navigation and explanation tasks. It is
the project's whole-picture rule.
<!-- lms-project-analytics:end -->

<!-- laya-control:background-delegation:start -->
## Automatic routed feature delegation

For an implementation-ready feature, first check `LAYA_ROUTED`. When it is
`1`, implement normally. Otherwise, when repository instructions provide a
Laya project ID, launch exactly one worker:

```bash
LAYA_ROUTED=1 "~/Documents/tools/laya-mcp-control/.venv/bin/laya-control" run \
  --agent codex \
  --project-id <PROJECT_ID_FROM_REPOSITORY_INSTRUCTIONS> \
  --cwd "$PWD" \
  --task "<complete feature request, constraints, and acceptance criteria>" \
  --background
```

Report the run ID and leave implementation to that worker. When no project ID
is provided, continue in the current session.
<!-- laya-control:background-delegation:end -->
