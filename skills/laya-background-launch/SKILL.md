---
name: laya-background-launch
description: Route a coding task through the local laya-control daemon and start a tracked background agent run on the recommended Command Code GOAT model. Use when asked to start, launch, delegate, or kick off a task in the background, or to run a feature unattended.
argument-hint: "<task description>"
---

# Laya Background Launch

Route a task via `/api/route-task`, take the recommended Command Code GOAT
model, and start **one** tracked background run with `laya-control run`.

## Guard — read before launching

- If `LAYA_ROUTED=1`, **stop**. You are already inside a delegated run;
  launching again recurses. Implement the work in the current session instead.
- Launch exactly one run per request. Do not fan out to several models.
- If `confidence_gates.require_user_confirmation` is true, confirm with the
  user before launching. If `require_plan` is true, say a plan is expected
  first.
- Never launch when the task is exploratory ("explain", "find", "audit") —
  that is `laya-model-recommend` territory, not a background job.

## Prerequisite

```bash
curl -s -m 5 http://127.0.0.1:8765/api/status >/dev/null && echo up || echo down
```

If the daemon is down, say so and stop.

## Steps

1. **Resolve the launcher binary.**

```bash
LAYA_CONTROL="$(command -v laya-control || true)"
# Known local install — adjust if this project moves.
[ -n "$LAYA_CONTROL" ] || LAYA_CONTROL="$HOME/Documents/tools/laya-mcp-control/.venv/bin/laya-control"
```

2. **Resolve the project id for the current repository.** Never hardcode it.

```bash
PROJECT_ID="$(curl -s http://127.0.0.1:8765/api/projects | python3 -c '
import json,sys,os
root=os.getcwd()
for p in json.load(sys.stdin)["items"]:
    if p["root_path"] == root: print(p["id"]); break')"
```

If empty, register it and retry:

```bash
curl -s -X POST http://127.0.0.1:8765/api/projects \
  -H 'Content-Type: application/json' -d "{\"root_path\":\"$PWD\"}"
```

3. **Route the task** — this is the direct `/api/route-task` call:

```bash
curl -s -X POST http://127.0.0.1:8765/api/route-task \
  -H 'Content-Type: application/json' \
  -d "{\"project_id\":$PROJECT_ID,\"task\":\"<complete task>\",\"top_k\":8}"
```

4. **Extract the model** from the response, in this order:

   - `commandcode_model_recommendations.recommended_model`
   - if that is `null`, `commandcode_model_recommendations.ranked_models[0].available_id`
   - if `commandcode_model_recommendations.status != "ok"` (CLI missing),
     fall back to `recommended_models.commandcode` and tell the user the
     budget-first ranking was unavailable.

5. **Start the run** with the model pinned:

```bash
"$LAYA_CONTROL" run \
  --agent commandcode \
  --project-id "$PROJECT_ID" \
  --cwd "$PWD" \
  --task "<complete task, with constraints and acceptance criteria>" \
  --model "<recommended model id>" \
  --background
```

6. **Report the run id**, then hand back these commands:

```bash
"$LAYA_CONTROL" runs                       # list runs
"$LAYA_CONTROL" status <RUN_ID>            # model, pid, timestamps, exit status
"$LAYA_CONTROL" logs <RUN_ID>              # JSONL output
tail -f ~/.laya-mcp-control/runs/<RUN_ID>.jsonl
```

## Rules

- The task string must be complete and self-contained. The worker does not see
  this conversation: include the requirement, constraints, and acceptance
  criteria.
- `--model` pins the model the worker uses; the launcher still routes
  internally to build the handoff document, so expect two `/api/route-task`
  calls per launch (each one probes Pi candidates and may consume quota).
- Do not claim the run succeeded. It starts `queued`. Verify with
  `status`/`logs` and the resulting diff before reporting an outcome.
- Runs and logs live in `~/.laya-mcp-control/runs/`. The model recorded in the
  run metadata is the pinned one.
