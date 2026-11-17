---
name: laya-model-recommend
description: Recommend the best Command Code GOAT model for a coding task by asking the local Laya daemon to classify it, ranked budget-first with region exclusions applied. Use when asked which model to use, to pick or recommend a model for a task, or to judge a task's difficulty tier.
argument-hint: "<task description>"
---

# Laya Model Recommend

Ask the local Laya decision model to classify a coding task, then return the
recommended Command Code GOAT model from the local catalog.

**This skill is advisory. It never launches, switches, or prices anything.**

## Prerequisite

The `laya-control` daemon must be running on `http://127.0.0.1:8765`:

```bash
curl -s -m 5 http://127.0.0.1:8765/api/status >/dev/null && echo up || echo down
```

If it is down, say so and stop. Do not invent a model recommendation.

## Steps

1. Get the task description from the user. If none was given, ask for it.

2. Call the `laya_decide` MCP tool with this exact shape — `model` must be
   `typed-decisions` and the catalog flag must be on:

```
laya_decide(
  state={"task": "<task description>"},
  questions=<ROUTING_QUESTIONS below>,
  model="typed-decisions",
  include_model_catalog=True
)
```

If the MCP tool is unavailable, POST the same body to `/api/decide`:

```bash
curl -s -X POST http://127.0.0.1:8765/api/decide \
  -H 'Content-Type: application/json' \
  -d '{"state":{"task":"<task>"},"questions":<ROUTING_QUESTIONS>,"model":"typed-decisions","include_model_catalog":true}'
```

ROUTING_QUESTIONS — send verbatim, do not invent criteria:

```json
{
  "workflow": {"type": "choice", "instructions": "Choose the appropriate coding workflow", "criteria": {
    "implement": "Clear change with sufficient context",
    "diagnose": "Existing broken behavior needs investigation",
    "inspect": "Examine codebase, trace dependencies, or locate references before modifying files",
    "design": "Architecture or interfaces must be decided",
    "explain": "No repository modification requested",
    "ask_user": "A material requirement is missing"}},
  "model_tier": {"type": "choice", "instructions": "Select appropriate AI model tier for this task", "criteria": {
    "fast": "Straightforward edits, documentation, unit tests, simple lookup",
    "balanced": "Standard multi-file implementation, refactoring, debugging",
    "reasoning": "High complexity architecture, database migration, or security-critical logic"}},
  "risk": {"type": "score", "instructions": "Estimate implementation and deployment risk", "criteria": [
    "Trivial isolated change", "Low risk", "Moderate cross-module risk", "High risk involving data, security, or compatibility"]},
  "needs_migration": {"type": "noul", "instructions": "The task likely requires a database migration"},
  "needs_browser_test": {"type": "noul", "instructions": "The task changes user-visible browser behavior"},
  "destructive": {"type": "noul", "instructions": "The task may delete, overwrite, or irreversibly modify important data"}
}
```

3. Resolve the tier. Start from `answers.model_tier.choice`, then apply these
   gates in order (they mirror the routing contract — do not skip them):

   - `answers.risk.score >= 2.5` **or** `answers.destructive.noul >= 0.20` → tier is `reasoning`
   - else `answers.workflow.confidence < 0.70` **and** tier is `fast` → tier is `balanced`
   - else keep `answers.model_tier.choice`

4. Read the model from `model_catalog`:

   - If `model_catalog.status != "ok"`, report the `error` and stop. The usual
     cause is the `cmd` CLI not being on PATH.
   - Otherwise use `model_catalog.recommendations_by_tier[<tier>]` and report
     `recommended_model`.
   - If `recommended_model` is `null`, no available model met that tier's
     intelligence floor. Say so and offer the highest-ranked `ranked_models`
     entry as a fallback instead of silently downgrading.

## Output

Report, in this order:

1. **Tier** and why (which gate fired, or "Laya's own choice").
2. **Recommended model** — the `recommended_model` value.
3. The top 3 `ranked_models` with `intelligence` and
   `illustrative_request_cost_usd`.
4. Counts of `excluded_models`, `unscored_models`, and
   `unmatched_available_models` when non-zero.

## Rules

- Never rank by inventing a blended quality score — report intelligence and
  the separate per-1M input/output/cache rates as distinct facts.
- `illustrative_request_cost_usd` is a comparison aid derived from an assumed
  request shape, not a billing or usage prediction. Label it as such.
- `excluded_models` are region/plan blocks the user declared in
  `~/.laya-mcp-control/model-exclusions.json`. Mention them when a model the
  user expected does not appear.
- `unmatched_available_models` are models in `cmd --list-models` that are not
  in the GOAT catalog — typically Pro/Max-only models. This is expected.
- Workflow confidence below `0.75` means the agent, not Laya, decides the
  workflow. Do not present a low-confidence classification as settled.
- If the user then wants to run the task, hand off to `laya-background-launch`
  rather than launching anything here.
