---
name: handoff-writer
description: Summarize what was implemented in a finished effort (spec, milestone, or session) from git history and task records, then write a handoff document for human operators covering every leftover manual action with exact commands, plus future work and open investigations with evidence pointers. Use when wrapping up a milestone, or when the user asks for a handoff, "what's left for humans", or an operator summary.
argument-hint: "<scope-topic> [base-ref]"
---

# Handoff Writer

Turn a finished body of work into two artifacts: a concise implemented-work summary and a
self-contained handoff document a human can act on without reading the conversation. The
document is the deliverable; the chat summary is the pointer to it.

## Inputs

- **Scope topic** (positional argument): what the handoff covers, e.g. a spec series or feature name.
- **Base ref** (optional): the git ref the work started from. Default to the main branch when omitted.
- Evidence sources, read all of them before writing: `git log <base>..HEAD --oneline`, the repo's
  task-tracking file(s) (e.g. `tasks/todo.md`, `tasks/plan.md`), the spec files' status lines, the
  latest full-suite test baseline, and any runbook docs that already exist.

## Steps

1. **Gather evidence.** From the sources above, list every workstream in scope with its completion
   state. Only claim what a record or commit proves — quote the evidence (commit, test counts,
   record line). Uncommitted or operator-gated work is never "implemented".

2. **Write the chat summary.** Compact: one line per workstream with state + evidence. This exists
   to point at the document, not replace it.

3. **Write the handoff document** to `docs/handoff-<slug>.md` (match the repo's existing handoff
   naming; create the file fresh). Use this template exactly:

   ```markdown
   # Handoff: <scope-topic> (<date>)

   ## Context
   2–4 sentences: what the effort was, which branch/specs carry it, and the one-line test baseline.

   ## What was implemented
   Per workstream: state, the concrete artifacts (files/commands/tests), and the evidence.
   Mark anything landed only on a branch (base ref, ahead-by count, pushed or not).

   ## Human actions required
   Numbered, in dependency order. Each action needs: the exact command(s) or console path,
   the environment it runs in, any prerequisite, and where to record the outcome
   (spec checklist, task file, runbook section). Operator/human gates get their own step.
   Reference an existing runbook for depth instead of duplicating it, but keep enough
   command detail here that the doc stands alone.

   ## Future work and investigations
   Each item: what, why it matters, where it was recorded (file + section). Include known
   baseline failures, deferred review findings, dependency/security notes, stale bookkeeping,
   and any decision left to the owner. No invented work — if it isn't recorded somewhere, it
   doesn't go here.

   ## Pointers
   Branch, specs, plans, runbooks, task-file sections — as paths.
   ```

4. **Wire it in.** If `docs/README.md` (or equivalent index) exists, add the handoff under its
   reference list. Commit per the repo's convention — if the session has been committing to a
   branch, commit there; otherwise leave the commit decision to the caller.

## Rules

- Every human action: exact command + environment + where to record the outcome. "Run the tests"
  is not an action; `PROVIDER_TESTS=1 ./vendor/bin/phpunit --group provider` on staging is.
- Distinguish **must-do-before-launch**, **human-gate** (judgment calls like review or linguist
  sign-off), and **optional improvement**.
- Report non-green baselines honestly (known failures counted separately, never hidden).
- If a "future investigation" turns out to be a false positive while you gather evidence, retract
  it in the task record as well as the handoff — do not hand a human a stale problem.
